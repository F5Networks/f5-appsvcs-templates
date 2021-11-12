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
}

module.exports = {
    BigipDeviceClassic
};
