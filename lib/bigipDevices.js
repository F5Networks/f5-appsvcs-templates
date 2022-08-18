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
const { TraceTags } = require('@f5devcentral/atg-shared-utilities').tracer;

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

    getDeviceInfo(ctx) {
        const span = (ctx) ? this._buildAndStartSpan('getDeviceInfo', ctx) : undefined;
        return this.endpoint.get('/mgmt/shared/identified-devices/config/device-info')
            .then(response => response.data)
            .finally(() => span.finish());
    }

    getSyncStatus(ctx) {
        const span = (ctx) ? this._buildAndStartSpan('getSyncStatus', ctx) : undefined;
        return this.endpoint.get('/mgmt/tm/cm/sync-status')
            .then(resp => resp.data.entries['https://localhost/mgmt/tm/cm/sync-status/0'].nestedStats.entries.status.description)
            .finally(() => span.finish());
    }

    getDeviceGroups(ctx) {
        const span = (ctx) ? this._buildAndStartSpan('getDeviceGroups', ctx) : undefined;
        return this.endpoint.get('/mgmt/tm/cm/device-group')
            .then(response => response.data.items)
            .finally(() => span.finish());
    }

    getDeviceGroupStats(deviceGroupName, ctx) {
        const span = (ctx) ? this._buildAndStartSpan('getDeviceGroupStats', ctx) : undefined;
        return this.endpoint.get(`/mgmt/tm/cm/device-group/${deviceGroupName}/stats`)
            .then(response => response.data.entries)
            .finally(() => span.finish());
    }

    getProvisionData(ctx) {
        const span = (ctx) ? this._buildAndStartSpan('getProvisionData', ctx) : undefined;
        return this.endpoint.get('/mgmt/tm/sys/provision')
            .then(response => response.data)
            .finally(() => span.finish());
    }

    getTSInfo(ctx) {
        const span = (ctx) ? this._buildAndStartSpan('getTSInfo', ctx) : undefined;
        return this.endpoint.get('/mgmt/shared/telemetry/info', {
            validateStatus: () => true // ignore failure status codes
        }).finally(() => span.finish());
    }

    getSharedObjects(endpoint, filter, ctx) {
        const span = (ctx) ? this._buildAndStartSpan('getSharedObjects', ctx) : undefined;
        return this.endpoint.get(`/mgmt/tm/${endpoint}?$select=fullPath`)
            .then((response) => {
                if (response.data.items) {
                    let results = response.data.items;
                    if (filter) {
                        Object.keys(filter).forEach((key) => {
                            results = results.filter(x => x[key].match(filter[key]));
                        });
                    }
                    span.finish();
                    return Promise.resolve(results.map(x => x.fullPath));
                }
                span.finish();
                return Promise.resolve([]);
            });
    }

    getIAppsBlocks(ctx) {
        const span = (ctx) ? this._buildAndStartSpan('getIAppsBlocks', ctx) : undefined;
        return this.endpoint.get('/mgmt/shared/iapp/blocks')
            .then((response) => {
                span.finish();
                return Promise.resolve(response.data.items);
            });
    }

    addIAppsBlock(blockData, ctx) {
        const span = (ctx) ? this._buildAndStartSpan('addIAppsBlock', ctx) : undefined;
        return this.endpoint.post('/mgmt/shared/iapp/blocks', blockData)
            .finally(() => span.finish());
    }

    copyUploadedFile(src, dst, ctx) {
        const span = (ctx) ? this._buildAndStartSpan('addIAppsBlock', ctx) : undefined;
        return fs.copy(src, dst).finally(() => span.finish());
    }

    watchConfigSyncStatus(callback, ctx) {
        const span = (ctx) ? this._buildAndStartSpan('watchConfigSyncStatus', ctx) : undefined;
        return this.getSyncStatus(ctx)
            .then((syncStatus) => {
                // Standalone means no HA, and that is the only reason we'd exit now.
                // There could have been a successful configSync since we last checked,
                // even if the status is Changes Pending
                if (syncStatus === 'Standalone') {
                    return Promise.resolve();
                }

                return this.getDeviceInfo(ctx)
                    .then((deviceInfo) => {
                        const hostname = deviceInfo.mcpDeviceName;
                        const pollSeconds = 60;

                        const getTimeSinceLastSync = () => this.getDeviceGroups(ctx)
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
                                        this.getDeviceGroupStats(dg.name, ctx)
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
            })
            .finally(() => span.finish());
    }

    _buildAndStartSpan(opName, ctx) {
        return ctx.tracer.startChildSpan(opName, ctx.span, { tags: { [TraceTags.APP.COMPONENT]: 'BIGIP_Classic' } });
    }
}

module.exports = {
    BigipDeviceClassic
};
