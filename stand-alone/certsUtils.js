/* Copyright 2024 F5 Networks, Inc.
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

const fs = require('fs');
const pathUtils = require('path');

const DEFAULT_WAIT_TIMEOUT = 5000; // 5 sec.
const DEFAULT_MAX_PENDING_OPS = 5;

class CertsRotation {
    /**
     * @param {function} cb
     * @param {CertsConfig} certsConfig
     * @param {object} [options]
     * @param {number} [options.maxPendingOps = DEFAULT_MAX_PENDING_OPS]
     * @param {number} [options.waitTimeout = DEFAULT_WAIT_TIMEOUT]
     */
    constructor(cb, certsConfig, options) {
        options = options || {};

        this.cb = cb;
        this.certsConfig = certsConfig;
        this.maxPendingOps = options.maxPendingOps || DEFAULT_MAX_PENDING_OPS;
        this.waitTimeout = options.waitTimeout || DEFAULT_WAIT_TIMEOUT;
    }

    /** @returns {void} once all activities started */
    start() {
        this._pendingOps = 0;
        this._timeoutID = null;
        this._fsWatchers = [];

        const dirs = {};
        const readCertsCb = readCertsCallback.bind(this);

        Object.keys(this.certsConfig).forEach((ctype) => {
            const fpath = this.certsConfig[ctype];
            const dirName = pathUtils.dirname(fpath);
            const fileName = pathUtils.basename(fpath);

            if (dirs[dirName]) {
                dirs[dirName].push(fileName);
                return;
            }

            dirs[dirName] = [fileName];

            this._fsWatchers.push(fs.watch(dirName, (event, fname) => {
                if (this._stopped || dirs[dirName].indexOf(fname) === -1) {
                    return;
                }

                console.log(`Certificate change detected (${event}:${fname}); scheduling configuration update`);
                this._pendingOps += 1;

                if (this._timeoutID && this._pendingOps <= this.maxPendingOps) {
                    clearTimeout(this._timeoutID);
                    this._timeoutID = null;
                }
                if (this._timeoutID === null) {
                    this._timeoutID = setTimeout(readCertsCb, this.waitTimeout);
                }
            }));
        });
    }

    /** @returns {void} once all activities stopped */
    stop() {
        this._stopped = true;

        if (this._fsWatchers) {
            this._fsWatchers.forEach(w => w.close());
        }

        if (this._timeoutID) {
            clearTimeout(this._timeoutID);
        }

        this._fsWatchers = undefined;
        this._timeoutID = undefined;
    }
}

/**
 * @param {CertsConfig} config
 *
 * @returns {number} most recent modification time or 0 when unable to fetch stats at all
 */
function mostRecentMtime(config) {
    let mtimeMs = 0;
    let ftimeMs = 0;
    Object.keys(config).forEach((ctype) => {
        try {
            ftimeMs = fs.statSync(config[ctype]).mtimeMs;
        } catch (err) {
            ftimeMs = 0;
        }
        if (ftimeMs > mtimeMs) {
            mtimeMs = ftimeMs;
        }
    });
    return mtimeMs;
}

/**
 * @this CertsRotationu8
 */
function readCertsCallback() {
    const certKeyChain = readCertsChain(this.certsConfig);
    if (certKeyChain.errors) {
        console.log(certKeyChain.errors);
        console.log('Certificate reload failed');
    } else {
        this.cb(certKeyChain.chain);
    }
}

/**
 * NOTE: does not throw error when unable to read the data.
 *
 * @param {CertsConfig} config
 *
 * @returns {{chain: CertsChain, errors: string}} chain
 */
function readCertsChain(config) {
    const ret = {};
    let errors = '';

    Object.keys(config).forEach((ctype) => {
        if (!config[ctype]) {
            return;
        }

        try {
            ret[ctype] = fs.readFileSync(config[ctype], 'utf8');
        } catch (err) {
            errors = `${errors}\n${err.message}`;
        }
    });
    return {
        chain: ret,
        errors: errors.trim()
    };
}

module.exports = {
    CertsRotation,
    mostRecentMtime,
    readCertsChain
};

/**
 * @typedef {object} CertsConfig
 * @property {string} ca - path to CA file
 * @property {string} cert - path to CERT file
 * @property {string} key - path to KEY file
 */
/**
 * @typedef {object} CertsChain
 * @property {string} ca - CA file data
 * @property {string} cert - CERT file data
 * @property {string} key - KEY file data
 */
