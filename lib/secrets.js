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

const { secureVault } = require('@f5devcentral/atg-shared-utilities');

class SecretsSecureVault {
    encrypt(data) {
        return Promise.resolve()
            .then(() => secureVault.encrypt(data));
    }

    decrypt(data) {
        return Promise.resolve()
            .then(() => secureVault.decrypt(data));
    }
}

class SecretsBase64 {
    encrypt(data) {
        return Promise.resolve()
            .then(() => Buffer.from(data, 'utf8').toString('base64'));
    }

    decrypt(data) {
        return Promise.resolve()
            .then(() => Buffer.from(data, 'base64').toString('utf8'));
    }
}

module.exports = {
    SecretsSecureVault,
    SecretsBase64
};
