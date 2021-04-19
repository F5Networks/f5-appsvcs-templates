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

process.AFL_TW_ROOT = '.';
process.AFL_TW_TS = path.join(__dirname, '../templates');

const fast = require('@f5devcentral/f5-fast-core');

const FastWorker = require('../nodejs/fastWorker');
const expressAdapter = require('./expressAdapter');

const { SecretsBase64 } = require('../lib/secrets');

const port = 8080;

const worker = new FastWorker({
    secretsManager: new SecretsBase64()
});
worker.storage = new fast.dataStores.StorageMemory();
worker.templateProvider.storage = worker.storage;
worker.configStorage = new fast.dataStores.StorageMemory();

console.log([
    'Warning: running FAST as a stand-alone application is only supported',
    'for development and debug purposes. It is not suitable for production environments.'
].join(' '));

expressAdapter.generateApp(worker)
    .then(app => app.listen(port));
