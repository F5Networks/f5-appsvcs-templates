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

/* eslint-disable no-console */

'use strict';

const path = require('path');

const fast = require('@f5devcentral/f5-fast-core');

const FastWorker = require('../nodejs/fastWorker');
const expressAdapter = require('./expressAdapter');

const { SecretsBase64 } = require('../lib/secrets');

const port = 8080;

let strictCerts = process.env.FAST_BIGIP_STRICT_CERT;
if (typeof strictCerts === 'string') {
    strictCerts = (
        strictCerts.toLowerCase() === 'true'
        || strictCerts === '1'
    );
}
const bigipInfo = {
    host: process.env.FAST_BIGIP_HOST,
    username: process.env.FAST_BIGIP_USER,
    password: process.env.FAST_BIGIP_PASSWORD,
    strictCerts
};

const worker = new FastWorker({
    configPath: '.',
    templatesPath: path.join(__dirname, '..', 'templates'),
    templateStorage: new fast.dataStores.StorageMemory(),
    configStorage: new fast.dataStores.StorageJsonFile('config.json'),
    secretsManager: new SecretsBase64(),
    bigipInfo
});

console.log([
    'Warning: running FAST as a stand-alone application is only supported',
    'for development and debug purposes. It is not suitable for production environments.'
].join(' '));

expressAdapter.generateApp(worker, {
    bigip: bigipInfo,
    staticFiles: path.join(__dirname, '../presentation')
})
    .then(app => app.listen(port));
