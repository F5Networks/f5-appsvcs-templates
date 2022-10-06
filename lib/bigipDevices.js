/* Copyright 2021 F5 Networks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const axios = require('axios');
const https = require('https');

const fs = require('fs-extra');

/** Class representing a BIG-IP Classic device. */
class BigipDeviceClassic {
    constructor(options) {
        options = options || {};
        this.host = options.host || 'http://localhost:8100';
        const username = options.username || 'admin';
        const password = options.password || '';
        this.configSyncTimeout = false;

        if (typeof options.strictCerts === 'undefined') {
            options.strictCerts = true;
        }

        this.endpoint = axios.create({
            baseURL: this.host,
            auth: {
                username,
                password
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: options.strictCerts
            })
        });
    }

    /**
     * collect information about the BIG-IP Device
     * @returns {Promise}
     */
    getDeviceInfo() {
        return this.endpoint.get('/mgmt/shared/identified-devices/config/device-info')
            .then(response => response.data);
    }

    /**
     * check if device is in a Cluster or if it is a Standalone
     * @returns {Promise}
     */
    getSyncStatus() {
        return this.endpoint.get('/mgmt/tm/cm/sync-status')
            .then(resp => resp.data.entries['https://localhost/mgmt/tm/cm/sync-status/0'].nestedStats.entries.status.description);
    }

    /**
     * get configured Device-Groups
     * @returns {Promise}
     */
    getDeviceGroups() {
        return this.endpoint.get('/mgmt/tm/cm/device-group')
            .then(response => response.data.items);
    }

    /**
     * get devices in specified Device-Group from its statistics
     * @param {string} deviceGroupName - name of device group
     * @returns {Promise}
     */
    getDeviceGroupStats(deviceGroupName) {
        return this.endpoint.get(`/mgmt/tm/cm/device-group/${deviceGroupName}/stats`)
            .then(response => response.data.entries);
    }

    /**
     * get provisioned modules
     * @returns {Promise}
     */
    getProvisionData() {
        return this.endpoint.get('/mgmt/tm/sys/provision')
            .then(response => response.data);
    }

    /**
     * get Telemetry Streaming info, just to determine whether it is installed
     * @returns {Promise}
     */
    getTSInfo() {
        return this.endpoint.get('/mgmt/shared/telemetry/info', {
            validateStatus: () => true // ignore failure status codes
        });
    }

    /**
     * get Enum of specified type for enumFromBigip
     * @param {Object} endpoint - FAST endpoint, path to enum type
     * @param {string} filter - regex to filter results
     * @returns {Promise}
     */
    getSharedObjects(endpoint, filter) {
        return this.endpoint.get(`/mgmt/tm/${endpoint}?$select=fullPath`)
            .then((response) => {
                if (response.data.items) {
                    let results = response.data.items;
                    if (filter) {
                        Object.keys(filter).forEach((key) => {
                            results = results.filter(x => x[key].match(filter[key]));
                        });
                    }
                    return Promise.resolve(results.map(x => x.fullPath));
                }
                return Promise.resolve([]);
            });
    }

    /**
     * get info about the installed FAST iApp LX package
     * @returns {Promise}
     */
    getIAppsBlocks() {
        return this.endpoint.get('/mgmt/shared/iapp/blocks')
            .then(response => response.data.items);
    }

    /**
     * save info about the installed FAST iApp LX package
     * @param {Object} blockData - info about the installed FAST iApp LX package
     * @returns {Promise}
     */
    addIAppsBlock(blockData) {
        return this.endpoint.post('/mgmt/shared/iapp/blocks', blockData);
    }

    /**
     * download zipped Template Set to new local file
     * @param {string} src - path/location of uploaded Template Set zip file
     * @param {string} dst - path/name of file to create in scratch dir
     * @returns {Promise}
     */
    copyUploadedFile(src, dst) {
        return fs.copy(src, dst);
    }

    /**
     * listen for and handle config-sync events that target this device
     * @param {Object} callback - FASTWorker function to call when config is sync'd
     * @returns {Promise}
     */
    watchConfigSyncStatus(callback) {
        return this.getSyncStatus()
            .then((syncStatus) => {
                // Standalone means no HA, and that is the only reason we'd exit now.
                // There could have been a successful configSync since we last checked,
                // even if the status is Changes Pending
                if (syncStatus === 'Standalone') {
                    return Promise.resolve();
                }

                return this.getDeviceInfo()
                    .then((deviceInfo) => {
                        const hostname = deviceInfo.mcpDeviceName;
                        const pollSeconds = 60;

                        const getTimeSinceLastSync = () => this.getDeviceGroups()
                            .then((deviceGroups) => {
                                // ignore default device groups that sync something other than the config we cache
                                const defaultDeviceGroups = ['datasync-global-dg', 'dos-global-dg', 'device_trust_group', 'gtm'];

                                // only check device groups that sync configurations in the /Common partition
                                return deviceGroups.filter(item => item.partition === 'Common' && !(defaultDeviceGroups.includes(item.name)));
                            })
                            .then((filteredDGs) => {
                                const promises = [];

                                filteredDGs.forEach((dg) => {
                                    // get statistics for each device group that might sync our config
                                    promises.push(
                                        this.getDeviceGroupStats(dg.name)
                                            .then((dgStats) => {
                                                // loop through devices in device group to find this device
                                                Object.values(dgStats).forEach((stats) => {
                                                    const tss = stats.nestedStats.entries.timeSinceLastSync.description;
                                                    const mcpDeviceName = stats.nestedStats.entries.device.description;
                                                    if (tss <= pollSeconds && mcpDeviceName === hostname) {
                                                        callback();
                                                    }
                                                });

                                                if (this.configSyncTimeout) {
                                                    clearTimeout(this.configSyncTimeout);
                                                }

                                                this.configSyncTimeout = setTimeout(
                                                    getTimeSinceLastSync,
                                                    pollSeconds * 1000
                                                );

                                                return Promise.resolve();
                                            })
                                            .catch(e => console.log(`FAST BigipDevice Error in Device Group Stats: ${e.message}`))
                                    );
                                });

                                return Promise.all(promises);
                            })
                            .catch(e => console.log(`FAST BigipDevice Error in Device Group: ${e.message}`));

                        return getTimeSinceLastSync();
                    });
            });
    }
}

module.exports = {
    BigipDeviceClassic
};
