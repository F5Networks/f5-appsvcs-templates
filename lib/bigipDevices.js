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

class BigipDeviceClassic {
    constructor(options) {
        options = options || {};
        this.host = options.host || 'http://localhost:8100';
        const username = options.username || 'admin';
        const password = options.password || '';

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

    getDeviceInfo() {
        return this.endpoint.get('/mgmt/shared/identified-devices/config/device-info')
            .then(response => response.data);
    }

    getSyncStatus() {
        return this.endpoint.get('/mgmt/tm/cm/sync-status')
            .then(resp => resp.data.entries['https://localhost/mgmt/tm/cm/sync-status/0'].nestedStats.entries.status.description);
    }

    getDeviceGroups() {
        return this.endpoint.get('/mgmt/tm/cm/device-group')
            .then(response => response.data.items);
    }

    getDeviceGroupStatus(deviceGroupName) {
        return this.endpoint.get(`/mgmt/tm/cm/device-group/${deviceGroupName}/stats`)
            .then(response => response.data.entries);
    }

    getProvisionData() {
        return this.endpoint.get('/mgmt/tm/sys/provision')
            .then(response => response.data);
    }

    getTSInfo() {
        return this.endpoint.get('/mgmt/shared/telemetry/info', {
            validateStatus: () => true // ignore failure status codes
        });
    }

    getSharedObjects(endpoint) {
        return this.endpoint.get(`/mgmt/tm/${endpoint}?$select=fullPath`)
            .then(response => response.data.items);
    }

    getIAppsBlocks() {
        return this.endpoint.get('/mgmt/shared/iapp/blocks')
            .then(response => response.data.items);
    }

    addIAppsBlock(blockData) {
        return this.endpoint.post('/mgmt/shared/iapp/blocks', blockData);
    }

    copyUploadedFile(src, dst) {
        return fs.copy(src, dst);
    }

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
                        const pollSeconds = 60;
                        let confSyncTimeout = false;

                        const getTimeSinceLastSync = () => {
                            const hostname = deviceInfo.mcpDeviceName;

                            // need to get all device groups to check for a recent configSync
                            this.getDeviceGroups()
                                .then((deviceGroups) => {
                                    // ignore default device groups that sync something other than the config we cache
                                    const defaultDeviceGroups = ['datasync-global-dg', 'dos-global-dg', 'device_trust_group', 'gtm'];

                                    // only check device groups that sync configurations in the /Common partition
                                    return deviceGroups.filter(item => item.partition === 'Common' && !(defaultDeviceGroups.includes(item.name)));
                                })
                                .then((filteredDGs) => {
                                    filteredDGs.forEach((dg) => {
                                        // get statistics for each device group that might sync our config
                                        this.getDeviceGroupStatus(dg.name)
                                            .then((dgStats) => {
                                                // loop through devices in device group to find this device
                                                Object.values(dgStats).forEach((stats) => {
                                                    const tss = stats.nestedStats.entries.timeSinceLastSync.description;
                                                    const mcpDeviceName = stats.nestedStats.entries.device.description;
                                                    if (tss <= pollSeconds && mcpDeviceName === hostname) {
                                                        callback();
                                                    }
                                                });

                                                if (confSyncTimeout) {
                                                    clearTimeout(confSyncTimeout);
                                                }
                                                confSyncTimeout = setTimeout(getTimeSinceLastSync, pollSeconds * 1000);
                                            })
                                            .catch(e => console.log(`FAST BigipDevice Error in Device Group Stats: ${e.message}`));
                                    });
                                })
                                .catch(e => console.log(`FAST BigipDevice Error in Device Group: ${e.message}`));
                        };

                        return getTimeSinceLastSync();
                    });
            });
    }
}

module.exports = {
    BigipDeviceClassic
};
