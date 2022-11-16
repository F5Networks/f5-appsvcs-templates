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

/** Class representing a Secure Vault object. */
class SecretsSecureVault {
    /**
     * encrypt string with Secure Vault
     * @param {string} data - string to encrypt
     * @returns {Promise}
     */
    encrypt(data) {
        return Promise.resolve()
            .then(() => secureVault.encrypt(data));
    }

    /**
     * decrypt string with Secure Vault
     * @param {string} data - encrypted string
     * @returns {Promise}
     */
    decrypt(data) {
        return Promise.resolve()
            .then(() => secureVault.decrypt(data));
    }
}

/** Class representing a Base64 Encoded string. */
class SecretsBase64 {
    /**
     * encode string as base64
     * @param {string} data - string to encode
     * @returns {Promise}
     */
    encrypt(data) {
        return Promise.resolve()
            .then(() => Buffer.from(data, 'utf8').toString('base64'));
    }

    /**
     * decode base64 string
     * @param {string} data - base64 encoded string
     * @returns {Promise}
     */
    decrypt(data) {
        return Promise.resolve()
            .then(() => Buffer.from(data, 'base64').toString('utf8'));
    }
}

module.exports = {
    SecretsSecureVault,
    SecretsBase64
};
