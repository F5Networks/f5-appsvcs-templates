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
        this.endpoint = axios.create({
            baseURL: options.host,
            auth: {
                username: options.username,
                password: options.password
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: options.strictCerts
            })
        });
    }

    getDeviceInfo() {
        return this.endpoint.get('/mgmt/shared/identified-devices/config/device-info');
    }

    getProvisionData() {
        return this.endpoint.get('/mgmt/tm/sys/provision');
    }

    getTSInfo() {
        return this.endpoint.get('/mgmt/shared/telemetry/info', {
            validateStatus: () => true // ignore failure status codes
        });
    }

    getSharedObjects(endpoint) {
        return this.endpoint.get(`/mgmt/tm/${endpoint}?$select=fullPath`);
    }

    getIAppsBlocks() {
        return this.endpoint.get('/mgmt/shared/iapp/blocks');
    }

    addIAppsBlock(blockData) {
        return this.endpoint.post('/mgmt/shared/iapp/blocks', blockData);
    }
}

module.exports = {
    BigipDeviceClassic
};
