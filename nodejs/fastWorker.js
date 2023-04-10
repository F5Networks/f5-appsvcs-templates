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

/* jshint ignore: start */

'use strict';

require('core-js');

const fs = require('fs-extra');
const crypto = require('crypto');
const url = require('url');

const extract = require('extract-zip');
const Ajv = require('ajv');
const merge = require('deepmerge');
const Mustache = require('mustache');
const semver = require('semver');
const axios = require('axios');
const uuid = require('uuid');

const fast = require('@f5devcentral/f5-fast-core');
const atgStorage = require('@f5devcentral/atg-storage');
const TeemDevice = require('@f5devcentral/f5-teem').Device;

const Tracer = require('../lib/tracer');
const drivers = require('../lib/drivers');
const { SecretsSecureVault } = require('../lib/secrets');

const FsTemplateProvider = fast.FsTemplateProvider;
const DataStoreTemplateProvider = fast.DataStoreTemplateProvider;
const StorageDataGroup = atgStorage.StorageDataGroup;
const AS3Driver = drivers.AS3Driver;
const TransactionLogger = fast.TransactionLogger;
const IpamProviders = require('../lib/ipam');
const { BigipDeviceClassic } = require('../lib/bigipDevices');

const pkg = require('../package.json');

const endpointName = 'fast';
const projectName = 'f5-appsvcs-templates';
const mainBlockName = 'F5 Application Services Templates';

const ajv = new Ajv({
    useDefaults: true
});
ajv.addFormat('checkbox', /.*/);
ajv.addFormat('table', /.*/);
ajv.addFormat('password', /.*/);
ajv.addFormat('text', /.*/);
ajv.addFormat('grid-strict', /.*/);
ajv.addFormat('textarea', /.*/);
ajv.addFormat('choices', /.*/);

// Disable HTML escaping
Mustache.escape = function escape(text) {
    return text;
};

const dataGroupPath = `/Common/${projectName}/dataStore`;

const configDGPath = `/Common/${projectName}/config`;
const configKey = 'config';
// Known good hashes for template sets
const supportedHashes = {
    'bigip-fast-templates': [
        'badf3fa1a5bcc81888ca2516c8069b176da49b0575e86c5e8e0e811e2c5fa7e9', // v1.24
        'a0982c93ca0e182a67887636fcb3b208b018c989ee1459f02ae83cf10e9e2175', // v1.23
        '2d88c05f2b7ce83e595c42c780d51b1216c0cafcc027762f6f01990d2d43105a', // v1.21
        '8b5152db4930aa1f18f6c25b7c8a508c2901b35307333505c971de3ad5e26ef4', // v1.20
        '9b65dc0d08c673806e5d38ba2ce36215f71b0c25efe82708cdb0009e33559e6a', // v1.19
        '1f887241f2a27a4525cac4ed2c642a4cc020e655febc42f69913e6df1d6ab240', // v1.18
        '0164bc45aa3597ab0c93406ad206f7dce42597899b8d533296dfa335d051181f', // v1.17
        '0acc8d8b76793c30e847257b85e30df708341c7fb347be25bb745a63ad411cc4', // v1.16
        '5d7e87d1dafc52d230538885e96db4babe43824f06a0e808a9c401105b912aaf', // v1.15
        '5d7e87d1dafc52d230538885e96db4babe43824f06a0e808a9c401105b912aaf', // v1.14
        '55e71bb2a511a1399bc41e9e34e657b2c0de447261ce3a1b92927094d988621e', // v1.13
        '42bd34feb4a63060df71c19bc4c23f9ec584507d4d3868ad75db51af8b449437', // v1.12
        '84904385ccc31f336b240ba1caa17dfab134d08efed7766fbcaea4eb61dae463', // v1.11
        '64d9692bdab5f1e2ba835700df4d719662b9976b9ff094fe7879f74d411fe00b', // v1.10
        '89f6d8fb68435c93748de3f175f208714dcbd75de37d9286a923656971c939f0', // v1.9
        'fbaee3fd9ecce14a2d90df8c155998749b49126e0eb80267e9b426c58677a164', // v1.8.1
        '42650496f8e1b00a7e8e6a7c148a781bb4204e95f09f66d7d89af5793ae0b8b7', // v1.8
        '83df55f23066fd0ac205ce3dca2c96ffd71e459914d7dcf205f3201fb1570427', // v1.7
        '9b65c17982fd5f83a36576c1a55f2771a0011283db8221704925ee803b8dbd13', // v1.6
        '48316eb5f20c6f3bc4e78ad50b0d82fae46fc3c7fa615fe438ff8f84b3a3c2ea', // v1.5
        '99bf347ba5556df2e8c7100a97ea4c24171e436ed9f5dc9dfb446387f29e0bfe', // v1.4
        'e7eba47ac564fdc6d5ae8ae4c5eb6de3d9d22673a55a2e928ab59c8c8e16376b', // v1.3
        '316653656cfd60a256d9b92820b2f702819523496db8ca01ae3adec3bd05f08c', // v1.2
        '985f9cd58299a35e83851e46ba7f4f2b1b0175cad697bed09397e0e07ad59217' //  v1.0
    ]
};

function _getPathElements(restOp) {
    const uri = restOp.getUri();
    const pathElements = decodeURI(uri.pathname).split('/');
    if (!uri.pathname.includes('shared/fast')) {
        pathElements.shift();
    }
    return {
        pathName: uri.pathname,
        collection: pathElements[3],
        collectionPath: pathElements.slice(0, 4).join('/'),
        itemId: pathElements[4],
        itemSubId: pathElements[5],
        elements: pathElements
    };
}

/** Class representing a FAST Worker process. */
class FASTWorker {
    constructor(options) {
        options = options || {};
        if (typeof options.uploadPath === 'undefined') {
            options.uploadPath = '/var/config/rest/downloads';
        }
        this.as3Info = null;
        this.foundTs = null;
        this.requestCounter = 1;
        this.packageName = options.packageName || pkg.name;
        this.version = options.version || pkg.version;

        this.tracer = new Tracer({
            name: this.packageName,
            version: this.version,
            spanNameFromRestOp: this._getTracerSpanFromOp,
            logger: this.logger
        });
        this.tracer.startSpan({
            requestId: 0,
            message: 'creating_fast_worker'
        });
        this.hookOnShutDown();
        this.state = {};

        this.baseUserAgent = `${this.packageName}/${this.version}`;
        this.incomingUserAgent = '';

        this.configPath = options.configPath || `/var/config/rest/iapps/${projectName}`;
        this.templatesPath = options.templatesPath || `${this.configPath}/templatesets`;
        this.uploadPath = options.uploadPath;
        this.scratchPath = `${this.configPath}/scratch`;

        this._lazyInitComplete = false;
        this.lazyInit = options.lazyInit;

        this.initRetries = 0;
        this.initMaxRetries = process.env.FAST_INIT_MAX_RETRIES || 15;
        this.initRetryDelay = process.env.FAST_INIT_RETRY_DELAY_IN_MS || 5000;
        this.initTimeout = false;

        this.isPublic = true;
        this.isPassThrough = true;
        this.WORKER_URI_PATH = `shared/${endpointName}`;
        this.WORKER_ALT_URI_PATHS = options.altUriPaths || [];
        const bigipInfo = options.bigipInfo || {
            host: 'http://localhost:8100',
            username: 'admin',
            password: '',
            strictCerts: true
        };
        this.bigip = options.bigipDevice || new BigipDeviceClassic(bigipInfo);
        this.driver = options.as3Driver || new AS3Driver({
            userAgent: this.baseUserAgent,
            bigipInfo,
            logger: this.logger
        });
        this.driver.setTracer(this.tracer);
        this.storage = options.templateStorage || new StorageDataGroup(dataGroupPath);
        this.configStorage = options.configStorage || new StorageDataGroup(configDGPath);
        this.fsTemplateProvider = new FsTemplateProvider(this.templatesPath, options.fsTemplateList, supportedHashes);
        this.templateProvider = new fast.CompositeTemplateProvider(
            [
                this.fsTemplateProvider,
                new DataStoreTemplateProvider(this.storage, undefined, supportedHashes)
            ],
            supportedHashes
        );
        if (options.disableTeem) {
            this.teemDevice = null;
        } else {
            this.teemDevice = options.teemDevice || new TeemDevice({
                name: projectName,
                version: this.version
            });
        }
        this.secretsManager = options.secretsManager || new SecretsSecureVault();
        this.transactionLogger = new TransactionLogger(
            (transaction) => {
                const [id, text] = transaction.split('@@');
                this.tracer.startChildSpan(id, text);
                this.logger.info(`FAST Worker [${id}]: Entering ${text}`);
            },
            (transaction, _exitTime, deltaTime) => {
                const [id, text] = transaction.split('@@');
                this.logger.info(`FAST Worker [${id}]: Exiting ${text}`);
                this.logger.fine(`FAST Worker [${id}]: ${text} took ${deltaTime}ms to complete`);
                this.tracer.endChildSpan(id, text);
            }
        );
        this.ipamProviders = options.ipamProviders;
        this.minAs3Version = options.minAs3Version || '3.16';

        this.requestTimes = {};
        this.provisionData = null;
        this._hydrateCache = null;
        this._provisionConfigCacheTime = null;
        this._provisionConfigCacheTTL = process.env.FAST_PROVISION_CONFIG_CACHE_TTL_IN_MS || 10000;

        this.tracer.logEvent(0, 'created_fast_worker');
    }

    /**
     * hook for additional logging during start up
     */
    hookCompleteRestOp() {
        // Hook completeRestOperation() so we can add additional logging
        this._prevCompleteRestOp = this.completeRestOperation;
        this.completeRestOperation = (restOperation) => {
            if (!Array.isArray(restOperation.body) && restOperation.body) {
                let selfLink = restOperation.uri.path ? `${restOperation.uri.path}` : `${restOperation.uri}`;
                if (selfLink.includes(this.WORKER_URI_PATH)) {
                    selfLink = selfLink.startsWith('/') ? `/mgmt${selfLink}` : `/mgmt/${selfLink}`;
                }
                restOperation.body._links = {
                    self: selfLink
                };
                if (restOperation.uri.path && restOperation.uri.path.includes('/applications') && ['Post', 'Patch', 'Put', 'Delete'].includes(restOperation.method) && restOperation.statusCode === 202) {
                    restOperation.body._links.task = restOperation.body.message.map(x => `${selfLink.substring(0, selfLink.lastIndexOf('/'))}/tasks/${x.id}`).pop();
                }
            } else if (Array.isArray(restOperation.body)) {
                restOperation.body = restOperation.body.map((x) => {
                    if (typeof x === 'object') {
                        let selfLink = '';
                        if (restOperation.uri.path && restOperation.uri.path.includes('/applications')) {
                            selfLink = restOperation.uri.path ? `${restOperation.uri.path.replace(/\/$/, '')}/${x.tenant}/${x.name}` : `${restOperation.uri}`;
                        } else if (restOperation.uri.path && restOperation.uri.path.includes('/tasks')) {
                            selfLink = restOperation.uri.path ? `${restOperation.uri.path.replace(/\/$/, '')}/${x.id}` : `${restOperation.uri}`;
                        } else {
                            selfLink = restOperation.uri.path ? `${restOperation.uri.path.replace(/\/$/, '')}/${x.name}` : `${restOperation.uri}`;
                        }
                        if (selfLink.includes(this.WORKER_URI_PATH)) {
                            selfLink = selfLink.startsWith('/') ? `/mgmt${selfLink}` : `/mgmt/${selfLink}`;
                        }
                        x._links = {
                            self: selfLink
                        };
                    }
                    return x;
                });
            }
            this.recordRestResponse(restOperation);
            return this._prevCompleteRestOp(restOperation);
        };
    }

    /**
     * hook for closing tracer on shut down
     */
    hookOnShutDown() {
        this._prevShutDown = this.onShutDown;
        this.onShutDown = () => {
            this.tracer.close();
            this._prevShutDown();
        };
    }

    /**
     * validate FASTWorker configuration
     * @param {Object} config - object containing the FASTWorker config Settings
     * @returns {Promise}
     */
    validateConfig(config) {
        return Promise.resolve()
            .then(() => ajv.compile(this.getConfigSchema()))
            .then((validate) => {
                const valid = validate(config);
                if (!valid) {
                    return Promise.reject(new Error(
                        `invalid config: ${JSON.stringify(validate.errors, null, 2)}`
                    ));
                }

                return Promise.resolve(config);
            });
    }

    /**
     * get default FASTWorker configuration
     * @returns {Object}
     */
    _getDefaultConfig() {
        const defaultConfig = {
            deletedTemplateSets: [],
            perfTracing: {
                enabled: String(process.env.F5_PERF_TRACING_ENABLED).toLowerCase() === 'true',
                debug: String(process.env.F5_PERF_TRACING_DEBUG).toLowerCase() === 'true'
            },
            enableIpam: false,
            tsIpAddress: '',
            ipamProviders: [],
            disableDeclarationCache: false,
            _gitTemplateSets: {}
        };
        return Object.assign({}, defaultConfig);
    }

    /**
     * get FASTWorker configuration
     * @param {number} reqid - FASTWorker process id, identifying the request
     * @returns {Promise}
     */
    getConfig(reqid) {
        reqid = reqid || 0;
        let mergedDefaults = this._getDefaultConfig();
        return Promise.resolve()
            .then(() => this.enterTransaction(reqid, 'gathering config data'))
            .then(() => Promise.all([
                this.configStorage.getItem(configKey),
                this.driver.getSettings()
            ]))
            .then(([config, driverSettings]) => {
                if (config) {
                    if (Array.isArray(config.ipamProviders)) {
                        // for compatibility with v1.9
                        config.ipamProviders = config.ipamProviders.map((provider) => {
                            if (typeof provider.serviceType === 'undefined') {
                                provider.serviceType = 'Generic';
                            }
                            return provider;
                        });
                    }
                    return Promise.resolve(Object.assign(
                        {},
                        mergedDefaults,
                        config,
                        driverSettings
                    ));
                }
                mergedDefaults = Object.assign({}, mergedDefaults, driverSettings);
                return Promise.resolve()
                    .then(() => {
                        this.logger.info('FAST Worker: no config found, loading defaults');
                    })
                    .then(() => this.configStorage.setItem(configKey, mergedDefaults))
                    .then(() => this.configStorage.persist())
                    .then(() => mergedDefaults);
            })
            .then((config) => {
                this.exitTransaction(reqid, 'gathering config data');
                return Promise.resolve(config);
            })
            .catch((e) => {
                this.logger.severe(`FAST Worker: Failed to load config: ${e.stack}`);
                return Promise.resolve(mergedDefaults);
            });
    }

    /**
     * get FASTWorker configuration schema
     * @returns {Object}
     */
    getConfigSchema() {
        let baseSchema = {
            $schema: 'http://json-schema.org/schema#',
            title: 'FAST Settings',
            type: 'object',
            properties: {
                deletedTemplateSets: {
                    type: 'array',
                    items: {
                        type: 'string'
                    },
                    uniqueItems: true,
                    options: {
                        hidden: true
                    }
                },
                disableDeclarationCache: {
                    title: 'Disable AS3 Declaration Cache',
                    type: 'boolean',
                    description: [
                        'Do not cache AS3 declarations.',
                        'This ensures FAST is always using up-to-date declarations from AS3,',
                        'which is only an issue if something other than FAST (e.g., config sync) is modifying AS3 config.',
                        'Disabling declaration caching will negatively impact FAST performance.'
                    ].join(' ')
                },
                enableIpam: {
                    title: 'Enable IPAM for Official F5 FAST Templates (Experimental/Beta)',
                    description: '**NOTE: An IPAM provider must be configured to deploy a valid application using IPAM.**',
                    type: 'boolean'
                },
                ipamProviders: {
                    title: 'IPAM Providers (Experimental/Beta)',
                    description: 'Configure IPAM providers that can be used in FAST templates to automatically manage IP addresses',
                    type: 'array',
                    items: {
                        oneOf: this.ipamProviders.getSchemas()
                    }
                },
                perfTracing: {
                    type: 'object',
                    properties: {
                        enabled: {
                            type: 'boolean',
                            default: false
                        },
                        endpoint: {
                            type: 'string'
                        },
                        debug: {
                            type: 'boolean',
                            default: false
                        }
                    },
                    options: {
                        hidden: true
                    }
                }
            },
            required: [
                'deletedTemplateSets'
            ]
        };

        baseSchema = fast.guiUtils.modSchemaForJSONEditor(baseSchema);

        return merge(this.driver.getSettingsSchema(), baseSchema);
    }

    /**
     * save FASTWorker configuration
     * @param {Object} config - object containing the FASTWorker config Settings
     * @param {number} reqid - FASTWorker process id, identifying the request
     * @returns {Promise}
     */
    saveConfig(config, reqid) {
        reqid = reqid || 0;
        let prevConfig;
        let persisted = false;
        const uniqueStr = uuid.v4();
        return Promise.resolve()
            .then(() => this.enterTransaction(reqid, 'saving config data', uniqueStr))
            .then(() => this.configStorage.getItem(configKey, config))
            .then((data) => {
                prevConfig = data;
            })
            .then(() => this.driver.setSettings(config))
            .then(() => this.configStorage.setItem(configKey, config))
            .then(() => {
                if (JSON.stringify(prevConfig) !== JSON.stringify(config)) {
                    persisted = true;
                    return this.recordTransaction(
                        reqid,
                        'persisting config',
                        this.configStorage.persist()
                    );
                }

                return Promise.resolve();
            })
            .then(() => this.exitTransaction(reqid, 'saving config data', uniqueStr))
            .then(() => persisted)
            .catch((e) => {
                this.logger.severe(`FAST Worker: Failed to save config: ${e.stack}`);
            });
    }

    /**
     * encrypt secrets in FASTWorker settings
     * @param {Object} newConfig - object containing the FASTWorker config Settings
     * @returns {Promise}
     */
    encryptConfigSecrets(newConfig) {
        return Promise.all((newConfig.ipamProviders || []).map(provider => Promise.resolve()
            .then(() => {
                const promises = [];
                if (typeof provider.password !== 'undefined') {
                    promises.push(this.secretsManager.encrypt(provider.password || ''));
                }
                if (typeof provider.authHeaderValue !== 'undefined') {
                    promises.push(this.secretsManager.encrypt(provider.authHeaderValue || ''));
                }
                return Promise.all(promises)
                    .then((encryptedValues) => {
                        provider.password = encryptedValues[0];
                        provider.authHeaderValue = encryptedValues[1];
                        return Promise.resolve();
                    });
            })));
    }

    /**
     * handle error from Response
     * @param {Object} e - error object returned with response
     * @param {string} description - describes what triggered the error
     * @returns {Promise}
     */
    handleResponseError(e, description) {
        description = description || 'request';
        if (e.response) {
            let body = e.response.data;
            if (body.pipe) {
                body.setEncoding('utf8');
                body = body.read();
            }
            const errData = JSON.stringify({
                status: e.response.status,
                body
            }, null, 2);
            return Promise.reject(new Error(`failed ${description}: ${errData}`));
        }
        return Promise.reject(e);
    }

    /**
     * FASTWorker's start up handler
     * @param {Object} success - callback for resolving the returned Promise
     * @param {Object} error - callback for rejecting the returned Promise
     * @returns {Promise}
     */
    onStart(success, error) {
        this.hookCompleteRestOp();
        // instantiate here to ensure logger instance is ready
        this.ipamProviders = new IpamProviders({
            secretsManager: this.secretsManager,
            transactionLogger: this.transactionLogger,
            logger: this.logger
        });
        this.hookOnShutDown();

        this.tracer.setLogger(this.logger);

        this.logger.info('FAST Worker: Entering STARTED state');
        this.logger.fine(`FAST Worker: Starting ${this.packageName} v${this.version}`);
        this.logger.fine(`FAST Worker: Targetting ${this.bigip.host}`);
        const startTime = Date.now();

        this.tracer.logEvent(0, 'app_start');

        return Promise.resolve()
            // Automatically add a block
            .then(() => {
                const hosturl = this.bigip.host ? url.parse(this.bigip.host) : '';
                if (hosturl.hostname !== 'localhost') {
                    return Promise.resolve();
                }

                return Promise.resolve()
                    .then(() => this.enterTransaction(0, 'ensure FAST is in iApps blocks'))
                    .then(() => this.bigip.getIAppsBlocks())
                    .catch(e => this.handleResponseError(e, 'to get blocks'))
                    .then((results) => {
                        const matchingBlocks = results.filter(x => x.name === mainBlockName);
                        const blockData = {
                            name: mainBlockName,
                            state: 'BOUND',
                            configurationProcessorReference: {
                                link: 'https://localhost/mgmt/shared/iapp/processors/noop'
                            },
                            presentationHtmlReference: {
                                link: `https://localhost/iapps/${projectName}/index.html`
                            }
                        };

                        if (matchingBlocks.length === 0) {
                            // No existing block, make a new one
                            return this.bigip.addIAppsBlock(blockData);
                        }

                        // Found a block, do nothing
                        return Promise.resolve({ status: 200 });
                    })
                    .catch(e => this.handleResponseError(e, 'to set block state'))
                    .then(() => this.exitTransaction(0, 'ensure FAST is in iApps blocks'));
            })
            .then(() => {
                if (this.lazyInit) {
                    this.tracer.logEvent(0, 'lazy_init_enabled');
                    return Promise.resolve(this._getDefaultConfig());
                }
                return this.initWorker(0);
            })
            // Done
            .then((config) => {
                const dt = Date.now() - startTime;
                this.logger.info('FAST Worker: Entering READY state');
                this.logger.fine(`FAST Worker: Startup completed in ${dt}ms`);
                this.tracer.logEvent(0, 'worker_initialized');
                this.tracer.endSpan(0);
                this.tracer.setOptions(this.deviceInfo, this.as3Info, config.perfTracing);
            })
            .then(() => success())
            // Errors
            .catch((e) => {
                this.logger.info(`FAST Worker: Entering UNHEALTHY state: ${e.message}`);
                if ((e.status && e.status === 404) || e.message.match(/404/)) {
                    this.logger.info('FAST Worker: onStart 404 error in initWorker; retry initWorker but start Express');
                    return success();
                }
                this.logger.severe(`FAST Worker: Failed to start: ${e.stack}`);
                this.tracer.logError(e);
                this.tracer.endSpan(0);
                return error();
            });
    }

    /**
     * handle FASTWorker's start up completed event
     * @param {Object} success - callback for resolving the returned Promise
     * @param {Object} error - callback for rejecting the returned Promise
     * @param {Object} _loadedState - not used anywhere, but Lint doesn't care
     * @param {string} errMsg - description of an error that occurred during start up
     * @returns {Object} either the success or error callback function
     */
    onStartCompleted(success, error, _loadedState, errMsg) {
        if (typeof errMsg === 'string' && errMsg !== '') {
            this.logger.error(`FAST Worker onStart error: ${errMsg}`);
            return error();
        }
        return success();
    }

    /**
     * initialize the FASTWorker process
     * @param {number} reqid - FASTWorker process id, identifying the request
     * @returns {Promise}
     */
    initWorker(reqid) {
        reqid = reqid || 0;
        let config;
        this._lazyInitComplete = true;

        return Promise.resolve()
            // Load config
            .then(() => this.getConfig(reqid))
            .then((cfg) => {
                this.tracer.logEvent(reqid, 'config_loaded');
                config = cfg;
            })
            .then(() => Promise.all([
                // Get and store device information
                this.setDeviceInfo(reqid),
                // Get the AS3 driver ready
                this.recordTransaction(
                    reqid,
                    'ready AS3 driver',
                    this.driver.loadMixins()
                        .then(() => this.driver.setSettings(config))
                ),
                // watch for configSync logs, if device is in an HA Pair
                this.recordTransaction(
                    reqid,
                    'setting up watch for config-sync',
                    this.bigip.watchConfigSyncStatus(this.onConfigSync.bind(this))
                ),
                // pre-cache templates at startup to avoid long requests
                this.recordTransaction(
                    reqid,
                    'readying templates',
                    this.templateProvider.listSets()
                        .then(setList => setList.map(
                            setName => this.gatherTemplateSet(reqid, setName, config, [])
                        ))
                )
            ]))
            .then(() => this.generateTeemReportOnStart(reqid))
            .then(() => Promise.resolve(config))
            .catch((e) => {
                if (this.initTimeout) {
                    clearTimeout(this.initTimeout);
                }
                this.logger.info(`FAST Worker: Entering UNHEALTHY state: ${e.message}`);
                // initWorker method will be retried for 404 errors; by default, 15 retries with 5 secs delay.
                // FAST_INIT_MAX_RETRIES and FAST_INIT_RETRY_DELAY env vars can be used for adjusting retries settings.
                if (this.initRetries <= this.initMaxRetries && ((e.status && e.status === 404) || e.message.match(/404/))) {
                    this.initRetries += 1;
                    this.logger.info(`FAST Worker: initWorker failed; Retry #${this.initRetries}. Error: ${e.message}`);
                    return this._delay(this.initRetryDelay)
                        .then(() => this.initWorker(reqid));
                }
                this.logger.severe(`FAST Worker: initWorker failed. ${e.message}\n${e.stack}`);
                return Promise.reject(e);
            });
    }

    /**
     * set timeout for retrying initialization of the FASTWorker process
     * @param {number} milliSeconds - FASTWorker process id, identifying the request
     * @returns {Promise}
     */
    _delay(milliSeconds) {
        return new Promise((resolve) => {
            this.initTimeout = setTimeout(resolve(), milliSeconds);
        });
    }

    /**
     * Lazy Initialization event handler
     * @param {number} reqid - FASTWorker process id, identifying the request
     * @returns {Promise}
     */
    handleLazyInit(reqid) {
        if (!this.lazyInit || this._lazyInitComplete) {
            return Promise.resolve();
        }

        return this.recordTransaction(
            reqid,
            'run lazy initialization',
            this.initWorker(reqid)
        );
    }

    /**
     * clear cache whenever BIG-IP device configuration is sync'd to this device
     */
    onConfigSync() {
        return Promise.resolve()
            .then(() => this.storage.clearCache())
            .then(() => this.configStorage.clearCache())
            .then(() => this.driver.invalidateCache())
            .then(() => this.templateProvider.invalidateCache());
    }

    /**
     * set information about the BIG-IP Device
     * @param {number} reqid - FASTWorker process id, identifying the request
     * @returns {Promise}
     */
    setDeviceInfo(reqid) {
        // If device-info is unavailable intermittently, this can be placed in onStart
        // and call setDeviceInfo in onStartCompleted
        // this.dependencies.push(this.restHelper.makeRestjavadUri(
        //     '/shared/identified-devices/config/device-info'
        // ));
        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid,
                'fetching device information',
                this.bigip.getDeviceInfo()
            )
                .then((data) => {
                    if (data) {
                        this.deviceInfo = {
                            hostname: data.hostname,
                            platform: data.platform,
                            platformName: data.platformMarketingName,
                            product: data.product,
                            version: data.version,
                            build: data.build,
                            edition: data.edition,
                            fullVersion: `${data.version}-${data.build}`
                        };
                    }
                }))
            .catch(e => this.handleResponseError(e, 'fetching BIG-IP device information'));
    }

    /**
     * TEEM Report Generators
     */

    /**
     * send Report data to TEEM server
     * @param {string} reportName - describes the event being reported
     * @param {number} reportVersion - 1
     * @param {Object} data - FAST config Settings and AS3 Driver data
     * @returns {Promise}
     */
    sendTeemReport(reportName, reportVersion, data) {
        if (!this.teemDevice) {
            return Promise.resolve();
        }

        const documentName = `${projectName}: ${reportName}`;
        const baseData = {
            userAgent: this.incomingUserAgent
        };
        this.teemDevice.report(documentName, `${reportVersion}`, baseData, data)
            .catch(e => this.logger.error(`FAST Worker failed to send telemetry data: ${e.stack}`));

        return Promise.resolve();
    }

    /**
     * generate TEEM report for onStart event
     * @param {number} reqid - FASTWorker process id, identifying the request
     * @returns {Promise}
     */
    generateTeemReportOnStart(reqid) {
        if (!this.teemDevice) {
            return Promise.resolve();
        }

        this.gatherInfo(reqid)
            .then(info => this.sendTeemReport('onStart', 1, info))
            .catch(e => this.logger.error(`FAST Worker failed to send telemetry data: ${e.stack}`));

        return Promise.resolve();
    }

    /**
     * generate TEEM report for Application Management activity
     * @param {string} action - action being performed on Application
     * @param {string} templateName - name of Application's template
     * @param {string} templateType - Application's template type
     * @returns {Promise}
     */
    generateTeemReportApplication(action, templateName, templateType) {
        if (!this.teemDevice) {
            return Promise.resolve();
        }

        templateType = templateType || 'local';

        const report = {
            action,
            templateName,
            templateType
        };
        this.sendTeemReport('Application Management', 1, report)
            .catch(e => this.logger.error(`FAST Worker failed to send telemetry data: ${e.stack}`));

        return Promise.resolve();
    }

    /**
     * generate TEEM report for Template Set Management activity
     * @param {string} action - action being performed on Template Set
     * @param {string} templateSetName - name of Template Set
     * @param {string} templateType - Template Set's type
     * @returns {Promise}
     */
    generateTeemReportTemplateSet(action, templateSetName, templateType) {
        if (!this.teemDevice) {
            return Promise.resolve();
        }

        templateType = templateType || 'local';

        const report = {
            action,
            templateSetName,
            templateType
        };
        Promise.resolve()
            .then(() => {
                if (action === 'create') {
                    return Promise.all([
                        this.templateProvider.getNumTemplateSourceTypes(templateSetName),
                        this.templateProvider.getNumSchema(templateSetName)
                    ])
                        .then(([numTemplateTypes, numSchema]) => {
                            report.numTemplateTypes = numTemplateTypes;
                            report.numSchema = numSchema;
                        });
                }
                return Promise.resolve();
            })
            .then(() => this.sendTeemReport('Template Set Management', 1, report))
            .catch(e => this.logger.error(`FAST Worker failed to send telemetry data: ${e.stack}`));

        return Promise.resolve();
    }

    /**
     * generate TEEM report for Error event
     * @param {Object} restOp - restOperation
     * @returns {Promise}
     */
    generateTeemReportError(restOp) {
        if (!this.teemDevice) {
            return Promise.resolve();
        }
        const pathElements = _getPathElements(restOp);
        let endpoint = pathElements.pathName;
        if (pathElements.itemId) {
            endpoint = `${endpoint}/item`;
        }
        const report = {
            method: restOp.getMethod(),
            endpoint,
            code: restOp.getStatusCode()
        };
        this.sendTeemReport('Error', 1, report)
            .catch(e => this.logger.error(`FAST Worker failed to send telemetry data: ${e.stack}`));

        return Promise.resolve();
    }

    /**
     * Helper functions
     */

    /**
     * get new FASTWorker request ID
     * @returns {Promise}
     */
    generateRequestId() {
        const retval = this.requestCounter;
        this.requestCounter += 1;
        return retval;
    }

    /**
     * get new Context for Performance Tracing
     * @param {Object} operation - restOperation
     * @returns {Promise}
     */
    _getTracerSpanFromOp(operation) {
        // returns /shared/fast/{collection}{/item...}{?queryParams}
        // no restOp indicates one of initial runs (i.e. onStart, fastWorker init)
        if (operation.isRestOp !== undefined && !operation.isRestOp) {
            const context = {
                requestId: operation.requestId,
                tracer: this.tracer
            };
            context.span = this.tracer.startHttpSpan(operation.message, 'None', 'None');
            return context;
        }
        const pathElements = _getPathElements(operation);
        const pathName = pathElements.pathName;
        const collectionPath = pathElements.collectionPath;
        const collection = pathElements.collection;
        const itemId = pathElements.itemId;

        const spanPath = (() => {
            switch (collection) {
            case 'info':
            case 'settings':
            case 'settings-schema':
                return collectionPath;
            case 'templates':
                return `${collectionPath}${itemId ? '/setName/{templateName}' : ''}`;
            case 'applications':
                return `${collectionPath}${itemId ? '/tenantName/{appName}' : ''}`;
            case 'tasks':
                return `${collectionPath}${itemId ? '/{taskId}' : ''}`;
            case 'templatesets':
                return `${collectionPath}${itemId ? '/{setName}' : ''}`;
            default:
                return pathName.substring(pathName.indexOf('/', 1));
            }
        })();

        return spanPath;
    }

    /**
     * enter Transaction Logging operation
     * @param {number} reqid - FASTWorker process id, identifying the request
     * @param {string} text - description of transaction
     * @param {string} uniqueStr - unique string used for transaction id
     * @returns {Promise}
     */
    enterTransaction(reqid, text, uniqueStr) {
        this.transactionLogger.enter(`${reqid}@@${text}@@${uniqueStr}`);
        return Promise.resolve();
    }

    /**
     * exit Transaction Logging operation
     * @param {number} reqid - FASTWorker process id, identifying the request
     * @param {string} text - description of transaction
     * @param {string} uniqueStr - unique string used for transaction id
     * @returns {Promise}
     */
    exitTransaction(reqid, text, uniqueStr) {
        this.transactionLogger.exit(`${reqid}@@${text}@@${uniqueStr}`);
        return Promise.resolve();
    }

    /**
     * record Transaction Logging operation
     * @param {number} reqid - FASTWorker process id, identifying the request
     * @param {string} text - description of transaction
     * @param {Promise} promise - Promise to resolve in this transaction
     * @returns {Promise}
     */
    recordTransaction(reqid, text, promise) {
        return this.transactionLogger.enterPromise(`${reqid}@@${text}@@${uuid.v4()}`, promise);
    }

    /**
     * filter list of Templates
     * @param {Object} templateNames - list of Templates to filter
     * @returns {Promise}
     */
    filterTemplates(templateNames) {
        if (!templateNames) {
            return Promise.resolve([]);
        }
        return Promise.resolve(templateNames)
            .then(tmplList => Promise.all(tmplList.map(
                x => this.templateProvider.fetch(x.name || x).then(tmpl => [x, tmpl])
                    .catch((e) => {
                        if (e.message.match(/Could not find template set/)) {
                            return Promise.resolve(undefined);
                        }
                        return Promise.reject(e);
                    })
            )))
            .then(tmpls => tmpls.filter(x => x && !x[1].bigipHideTemplate))
            .then(tmpls => tmpls.map(x => x[0]));
    }

    /**
     * gather Template Set information
     * @param {string} tsid - name of Template Set to gather
     * @param {Object} config - object containing the FASTWorker config Settings
     * @param {Array} apps - optional list of applications (will fetch if not provided)
     * @returns {Promise}
     */
    gatherTemplateSet(reqid, tsid, config, apps) {
        return Promise.all([
            this.templateProvider.hasSet(tsid)
                .then(result => (result ? this.templateProvider.getSetData(tsid) : Promise.resolve(undefined))),
            Promise.resolve()
                .then(() => {
                    if (typeof apps !== 'undefined') {
                        return Promise.resolve(apps);
                    }

                    return this.recordTransaction(
                        reqid,
                        'gathering a list of applications from the driver',
                        this.driver.listApplications({ reqid })
                    );
                })
        ])
            .then(([tsData, appsList]) => {
                if (!tsData) {
                    return Promise.reject(new Error(`Template set ${tsid} does not exist`));
                }

                tsData.templates.forEach((tmpl) => {
                    tmpl.appsList = appsList
                        .filter(x => x.template === tmpl.name)
                        .map(x => `${x.tenant}/${x.name}`);
                });
                const gitData = config._gitTemplateSets[tsid];
                Object.assign(tsData, gitData);
                tsData.enabled = !config.deletedTemplateSets.includes(tsid);
                return tsData;
            })
            .then(tsData => this.filterTemplates(tsData.templates)
                .then((templates) => {
                    tsData.templates = templates;
                    return tsData;
                }))
            .catch(e => ({
                name: tsid,
                hash: '',
                templates: [],
                enabled: false,
                error: e.message
            }));
    }

    /**
     * collect FAST config Settings and AS3 Driver data
     * @param {number} requestId - FASTWorker process id, identifying the request
     * @returns {Promise}
     */
    gatherInfo(requestId) {
        requestId = requestId || 0;
        const info = {
            version: this.version,
            as3Info: {},
            installedTemplates: []
        };

        let config;

        return Promise.resolve()
            .then(() => {
                if (this.as3Info) {
                    return Promise.resolve(this.as3Info);
                }

                return this.recordTransaction(
                    requestId,
                    'GET to appsvcs/info',
                    this.driver.getInfo({ requestId })
                )
                    .then(response => response.data);
            })
            .then((as3response) => {
                info.as3Info = as3response;
                this.as3Info = info.as3Info;
            })
            .then(() => this.getConfig(requestId)
                .then((data) => { config = data; }))
            .then(() => this.enterTransaction(requestId, 'gathering template set data'))
            .then(() => Promise.all([
                this.templateProvider.listSets(),
                this.recordTransaction(
                    requestId,
                    'gathering a list of applications from the driver',
                    this.driver.listApplications({ requestId })
                )
            ]))
            .then(([setList, appsList]) => Promise.all(setList.map(
                setName => this.gatherTemplateSet(requestId, setName, config, appsList)
            )))
            .then((tmplSets) => {
                info.installedTemplates = tmplSets;
            })
            .then(() => this.exitTransaction(requestId, 'gathering template set data'))
            .then(() => this.getConfig(requestId))
            .then(() => {
                const retVal = Object.assign({}, config);
                Object.keys(retVal).forEach((key) => {
                    // Remove any "private" keys
                    if (key.startsWith('_')) {
                        delete retVal[key];
                    }
                });
                info.config = retVal;
            })
            .then(() => info);
    }

    /**
     * gather Provision data for FASTWorker Settings
     * @param {number} requestId - FASTWorker process id, identifying the request
     * @param {boolean} clearCache - if true, rebuild provision data when cache is more than 10 seconds old
     * @param {boolean} skipAS3 - if true, use cached AS3 info
     * @returns {Promise}
     */
    gatherProvisionData(requestId, clearCache, skipAS3) {
        if (clearCache && (Date.now() - this._provisionConfigCacheTime) >= this._provisionConfigCacheTTL) {
            this.provisionData = null;
            this.foundTs = null;
            this._provisionConfigCacheTime = Date.now();
        }
        return Promise.all([
            Promise.resolve()
                .then(() => {
                    if (this.provisionData !== null) {
                        return Promise.resolve(this.provisionData);
                    }

                    return this.recordTransaction(
                        requestId,
                        'Fetching module provision information',
                        this.bigip.getProvisionData()
                    );
                })
                .then((response) => {
                    this.provisionData = response;
                }),
            Promise.resolve()
                .then(() => {
                    if (this.foundTs !== null) {
                        return Promise.resolve(this.foundTs);
                    }

                    return this.recordTransaction(
                        requestId,
                        'Fetching TS module information',
                        this.bigip.getTSInfo()
                    )
                        .then((response) => { this.foundTs = response.status && response.status < 400; });
                }),
            Promise.resolve()
                .then(() => {
                    if (skipAS3 || (this.as3Info !== null && this.as3Info.version)) {
                        return Promise.resolve(this.as3Info);
                    }
                    return this.recordTransaction(
                        requestId,
                        'Fetching AS3 info',
                        this.driver.getInfo({ requestId })
                    )
                        .then(response => response.data);
                })
                .then((response) => {
                    this.as3Info = response;
                })
        ])
            .then(() => {
                const tsLevel = this.foundTs ? 'nominal' : 'none';
                const tsInfo = this.provisionData.items.filter(x => x.name === 'ts')[0];
                if (!tsInfo) {
                    // Create fake ts module
                    this.provisionData.items.push({
                        name: 'ts',
                        level: this.foundTs ? 'nominal' : 'none'
                    });
                } else {
                    // Module already exists, update it
                    tsInfo.level = tsLevel;
                }
            })
            .then(() => {
                // Update driver settings while we have updated provision data
                const provisionedModules = this.provisionData.items
                    .filter(x => x.level !== 'none')
                    .map(x => x.name);

                return this.recordTransaction(
                    requestId,
                    'updating AS3 driver with module provisioning information',
                    this.driver.updateProvisionInfo(provisionedModules)
                );
            })
            .then(() => Promise.all([
                Promise.resolve(this.provisionData),
                Promise.resolve(this.as3Info),
                Promise.resolve(this.deviceInfo)
            ]));
    }

    /**
     * check Dependencies and only display (sub)templates/properties available on the device
     * @param {Object} tmpl - Template to check
     * @param {number} requestId - FASTWorker process id, identifying the request
     * @param {boolean} clearCache - if true, rebuild provision data when cache is more than 10 seconds old
     * @returns {Promise}
     */
    checkDependencies(tmpl, requestId, clearCache) {
        return Promise.resolve()
            .then(() => this.gatherProvisionData(requestId, clearCache, false))
            .then(([provisionData, as3Info, deviceInfo]) => {
                // check for missing module dependencies
                const provisionedModules = provisionData.items.filter(x => x.level !== 'none').map(x => x.name);
                const deps = tmpl.bigipDependencies || [];
                const missingModules = deps.filter(x => !provisionedModules.includes(x));
                if (missingModules.length > 0) {
                    return Promise.reject(new Error(
                        `could not load template (${tmpl.title}) due to missing modules: ${missingModules}`
                    ));
                }

                // check AS3 Version minimum
                const as3Version = semver.coerce(as3Info.version || '0.0');
                const tmplAs3Version = semver.coerce(tmpl.bigipMinimumAS3 || this.minAs3Version);
                if (!semver.gte(as3Version, tmplAs3Version)) {
                    return Promise.reject(new Error(
                        `could not load template (${tmpl.title}) since it requires`
                        + ` AS3 >= ${tmplAs3Version} (found ${as3Version})`
                    ));
                }

                // check min/max BIG-IP version
                const semverFromBigip = (version) => {
                    version = version.toString();
                    let verParts = version.split('.');
                    if (verParts.length < 2) {
                        verParts.push('0');
                    }
                    verParts = [
                        verParts[0] + verParts[1],
                        ...verParts.slice(2)
                    ];
                    return semver.coerce(verParts.join('.'));
                };
                const bigipVersion = semverFromBigip(deviceInfo.version || '13.1');
                const tmplBigipMin = semverFromBigip(tmpl.bigipMinimumVersion || '13.1');
                if (!semver.gte(bigipVersion, tmplBigipMin)) {
                    return Promise.reject(new Error(`could not load template (${tmpl.title}) since it requires BIG-IP >= ${tmpl.bigipMinimumVersion} (found ${deviceInfo.version})`));
                }
                const tmplBigipMax = semverFromBigip(tmpl.bigipMaximumVersion || '999.999');
                if (!semver.lte(bigipVersion, tmplBigipMax)) {
                    return Promise.reject(new Error(`could not load template (${tmpl.title}) since it requires BIG-IP maximum version of ${tmpl.bigipMaximumVersion} (found ${deviceInfo.version})`));
                }

                // check subTemplates
                let promiseChain = Promise.resolve();
                tmpl._allOf.forEach((subtmpl) => {
                    promiseChain = promiseChain
                        .then(() => this.checkDependencies(subtmpl, requestId, false));
                });
                const validOneOf = [];
                let errstr = '';
                tmpl._oneOf.forEach((subtmpl) => {
                    promiseChain = promiseChain
                        .then(() => this.checkDependencies(subtmpl, requestId, false))
                        .then(() => {
                            validOneOf.push(subtmpl);
                        })
                        .catch((e) => {
                            errstr += errstr === '' ? '' : '; ';
                            errstr += `${e.message}`;
                            return Promise.resolve();
                        });
                });
                promiseChain = promiseChain
                    .then(() => {
                        if (tmpl._oneOf.length > 0 && validOneOf.length !== 1) {
                            return Promise.reject(new Error(
                                `could not load template since no single oneOf had valid dependencies: Value must validate against exactly one of the provided schemas. ${errstr}`
                            ));
                        }
                        tmpl._oneOf = validOneOf;
                        return Promise.resolve();
                    });
                const validAnyOf = [];
                let errstrAnyOf = '';
                tmpl._anyOf.forEach((subtmpl) => {
                    promiseChain = promiseChain
                        .then(() => this.checkDependencies(subtmpl, requestId, false))
                        .then(() => {
                            validAnyOf.push(subtmpl);
                        })
                        .catch((e) => {
                            errstrAnyOf += errstrAnyOf === '' ? '' : '; ';
                            errstrAnyOf += `${e.message}`;
                            return Promise.resolve();
                        });
                });
                promiseChain = promiseChain
                    .then(() => {
                        if (tmpl._anyOf.length > 0) {
                            if (validAnyOf.length === 0) {
                                return Promise.reject(new Error(
                                    `could not load template since no anyOf had valid dependencies: ${errstrAnyOf}`
                                ));
                            }
                        }
                        tmpl._anyOf = validAnyOf;
                        return Promise.resolve();
                    });
                return promiseChain;
            });
    }

    /**
     * get child properties from Schema by name
     * @param {Object} schema - property schema object
     * @param {string} childName - name of properties to find
     * @param {boolean} recurse - if true, get child properties from results
     * @returns {Promise}
     */
    getPropsWithChild(schema, childName, recurse) {
        const subSchemas = [
            ...schema.allOf || [],
            ...schema.oneOf || [],
            ...schema.anyOf || []
        ];
        const props = Object.entries(schema.properties || {})
            .reduce((acc, curr) => {
                const [key, value] = curr;
                if (value[childName]) {
                    acc[key] = value;
                }
                if (value.items) {
                    if (value.items[childName]) {
                        acc[`${key}.items`] = value.items;
                    } else if (value.items.oneOf) {
                        const prop = value.items.oneOf.find(i => i[childName]);
                        if (typeof prop !== 'undefined') {
                            acc[key] = prop;
                        }
                    }
                }
                return acc;
            }, {});

        if (recurse) {
            subSchemas.map(subSchema => Object.assign(props, this.getPropsWithChild(subSchema, childName)));
        }

        return props;
    }

    /**
     * hydrate Schema for Template
     * @param {Object} tmpl - Template to hydrate
     * @param {number} requestId - FASTWorker process id, identifying the request
     * @param {boolean} clearCache - if true, reset FASTWorker.hydrateCache to null
     * @returns {Promise}
     */
    hydrateSchema(tmpl, requestId, clearCache) {
        const schema = tmpl._parametersSchema;
        const subTemplates = [
            ...tmpl._allOf || [],
            ...tmpl._oneOf || [],
            ...tmpl._anyOf || []
        ];

        if (clearCache) {
            this._hydrateCache = null;
        }

        const ipFromIpamProps = this.getPropsWithChild(schema, 'ipFromIpam');
        const enumFromBigipProps = this.getPropsWithChild(schema, 'enumFromBigip');

        const propNames = Object.keys(enumFromBigipProps)
            .concat(Object.keys(ipFromIpamProps));
        if (propNames.length > 0) {
            this.logger.fine(
                `FAST Worker [${requestId}]: Hydrating properties: ${JSON.stringify(propNames, null, 2)}`
            );
        }

        if (!this._hydrateCache) {
            this._hydrateCache = {};
        }

        return Promise.resolve()
            .then(() => {
                if (ipFromIpamProps.length === 0) {
                    return Promise.resolve();
                }

                if (this._hydrateCache.__config) {
                    return Promise.resolve();
                }

                return this.getConfig(requestId)
                    .then((config) => {
                        this._hydrateCache.__config = config;
                    });
            })
            .then(() => Promise.all(subTemplates.map(x => this.hydrateSchema(x, requestId, false))))
            .then(() => {
                const config = this._hydrateCache.__config;
                Object.values(ipFromIpamProps).forEach((prop) => {
                    if (config.ipamProviders.length === 0) {
                        prop.enum = [null];
                    } else {
                        prop.enum = config.ipamProviders.map(x => x.name);
                    }
                });
            })
            .then(() => Promise.all(Object.values(enumFromBigipProps).map((prop) => {
                let endPoints;
                if (typeof prop.enumFromBigip === 'object' && prop.enumFromBigip.path) {
                    endPoints = Array.isArray(prop.enumFromBigip.path)
                        ? prop.enumFromBigip.path : [prop.enumFromBigip.path];
                } else if (Array.isArray(prop.enumFromBigip) || typeof prop.enumFromBigip === 'string') {
                    endPoints = Array.isArray(prop.enumFromBigip) ? prop.enumFromBigip : [prop.enumFromBigip];
                } else {
                    endPoints = [];
                }
                return Promise.resolve()
                    .then(() => Promise.all(endPoints.map(endPoint => Promise.resolve()
                        .then(() => {
                            if (this._hydrateCache[endPoint]) {
                                return this._hydrateCache[endPoint];
                            }

                            return this.recordTransaction(
                                requestId,
                                `fetching data from ${endPoint}`,
                                this.bigip.getSharedObjects(endPoint, prop.enumFromBigip.filter)
                            )
                                .then((items) => {
                                    this._hydrateCache[endPoint] = items;
                                    return items;
                                });
                        })
                        .catch(e => this.handleResponseError(e, `GET to ${endPoint}`))
                        .catch(e => Promise.reject(new Error(`Failed to hydrate ${endPoint}\n${e.message}`))))))
                    .then(itemsArrays => itemsArrays.flat())
                    .then((items) => {
                        if (items.length !== 0) {
                            prop.enum = items;
                        } else {
                            prop.enum = [null];
                        }
                    });
            })))
            .then(() => schema);
    }

    /**
     * remove IPAM properties when not enabled
     * @param {Object} tmpl - Template to remove IPAM from
     * @param {number} requestId - FASTWorker process id, identifying the request
     * @returns {Promise}
     */
    removeIpamProps(tmpl, requestId) {
        const subTemplates = [
            ...tmpl._allOf || [],
            ...tmpl._oneOf || [],
            ...tmpl._anyOf || []
        ];

        if (!this._hydrateCache) {
            this._hydrateCache = {};
        }

        return Promise.resolve()
            .then(() => Promise.all(subTemplates.map(x => this.removeIpamProps(x, requestId))))
            .then(() => {
                if (this._hydrateCache.__config) {
                    return Promise.resolve(this._hydrateCache.__config);
                }

                return this.getConfig(requestId)
                    .then((config) => {
                        this._hydrateCache.__config = config;
                        return Promise.resolve(config);
                    });
            })
            .then((config) => {
                if (config.enableIpam) {
                    return Promise.resolve();
                }

                const schema = tmpl._parametersSchema;
                const props = schema.properties;

                const ipamProps = Object.keys(props).filter(x => x.endsWith('_ipam'));

                ipamProps.forEach((propName) => {
                    delete props[propName];
                });

                if (schema.dependencies) {
                    Object.entries(schema.dependencies).forEach(([key, value]) => {
                        value = value.filter(x => !x.endsWith('use_ipam'));
                        if (value.length === 0) {
                            delete schema.dependencies[key];
                        } else {
                            schema.dependencies[key] = value;
                        }
                    });
                }

                return Promise.resolve();
            });
    }

    /**
     * redeploy converted Applications with updates for version discrepencies
     * @param {Object} restOperation
     * @param {Object[]} apps - array of Applications to convert
     * @returns {Promise}
     */
    migrateLegacyApps(restOperation, apps) {
        const reqid = restOperation.requestId;
        const convertTemplateNames = [
            'bigip-fast-templates/http',
            'bigip-fast-templates/tcp',
            'bigip-fast-templates/microsoft_iis'
        ];
        const oldGtmTemplateNames = [
            'bigip-fast-templates/http',
            'bigip-fast-templates/microsoft_iis'
        ];
        const shouldConvertWideIp = app => (
            oldGtmTemplateNames.includes(app.template)
            && app.template
            && typeof app.template === 'string'
            && app.view.gtm_fqdn
            && typeof app.view.gtm_fqdn === 'string'
            && app.view.gtm_fqdn !== ''
        );
        const poolConvertingApps = [];
        const oldGtmApps = [];
        let newApps = [];

        apps.forEach((app) => {
            const convertPool = (
                convertTemplateNames.includes(app.template)
                && app.view.pool_members
                && app.view.pool_members.length > 0
                && typeof app.view.pool_members[0] === 'string'
            );

            if (convertPool) {
                app.view.pool_members = [{
                    serverAddresses: app.view.pool_members,
                    servicePort: app.view.pool_port || 80
                }];
                delete app.view.pool_port;

                newApps.push(app);
                this.logger.info(
                    `FAST Worker [${reqid}]: updating pool_members on ${app.tenant}/${app.name}`
                );

                if (shouldConvertWideIp(app)) {
                    poolConvertingApps.push(app);
                }

                return;
            }

            if (shouldConvertWideIp(app)) {
                oldGtmApps.push(app);
            }
        });

        let promiseChain = Promise.resolve();
        if (poolConvertingApps.length > 0 || oldGtmApps.length > 0) {
            promiseChain = promiseChain
                .then(() => this.gatherProvisionData(reqid, true, true))
                .then(([provisionData]) => {
                    const gtmProvisioned = provisionData.items.filter(x => x.name === 'gtm' && x.level !== 'none');
                    if (gtmProvisioned.length > 0) {
                        const convert = (app) => {
                            const oldTemplate = app.template;
                            app.template = `${oldTemplate}_wideip`;
                            newApps.push(app);
                            this.logger.info(
                                `FAST Worker [${reqid}]: migrating ${app.tenant}/${app.name} from ${oldTemplate} to ${app.template}`
                            );
                        };

                        // apps with pool members being converted
                        poolConvertingApps.forEach((app) => {
                            Object.keys(newApps).forEach((key) => {
                                if (newApps[key].tenant === app.tenant && newApps[key].name === app.name) {
                                    delete newApps[key];
                                }
                            });
                            convert(app);
                            newApps = newApps.filter(newApp => newApp);
                        });

                        // apps without pool members needing converted
                        oldGtmApps.forEach((app) => {
                            convert(app);
                        });
                    }
                });
        }
        // clone restOp, but make sure to unhook complete op
        const postOp = Object.assign(Object.create(Object.getPrototypeOf(restOperation)), restOperation);
        postOp.complete = () => postOp;
        postOp.setMethod('Post');

        if (newApps.length > 0 || poolConvertingApps.length > 0 || oldGtmApps.length > 0) {
            promiseChain = promiseChain
                .then(() => {
                    postOp.setBody(newApps.map(app => ({
                        name: app.template,
                        parameters: app.view
                    })));
                    return this.onPost(postOp);
                })
                .then(() => {
                    if (postOp.getStatusCode() >= 400) {
                        return Promise.reject(new Error(
                            `Updating pool_members failed with ${postOp.getStatusCode()}: ${postOp.getBody().message}`
                        ));
                    }

                    this.logger.info(
                        `FAST Worker [${reqid}]: task ${postOp.getBody().message[0].id} submitted to update pool_members`
                    );

                    return Promise.resolve();
                });
        }

        return promiseChain
            .then(() => apps);
    }

    /**
     * release IP Address from IPAM
     * @param {number} reqid - FASTWorker process id, identifying the request
     * @param {string} appsData - rendered Template
     * @returns {Promise}
     */
    releaseIPAMAddressesFromApps(reqid, appsData) {
        let config;
        let promiseChain = Promise.resolve();
        appsData.forEach((appDef) => {
            let view;
            if (appDef.metaData) {
                if (Object.keys(appDef.metaData.ipamAddrs || {}) === 0) {
                    return;
                }
                view = appDef.metaData;
            } else {
                if (Object.keys(appDef.ipamAddrs || {}) === 0) {
                    return;
                }
                view = appDef;
            }

            promiseChain = promiseChain
                .then(() => {
                    if (config) {
                        return Promise.resolve(config);
                    }
                    return this.getConfig(reqid)
                        .then((c) => { config = c; });
                })
                .then(() => this.ipamProviders.releaseIPAMAddress(reqid, config, view));
        });

        return promiseChain;
    }

    /**
     * GET Template
     * @param {number} reqid - FASTWorker process id, identifying the request
     * @param {string} tmplid - name of Template
     * @returns {Promise}
     */
    fetchTemplate(reqid, tmplid) {
        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid,
                'fetching template',
                this.templateProvider.fetch(tmplid)
            ))
            // Copy the template to avoid modifying the stored template
            .then(tmpl => fast.Template.fromJson(JSON.stringify(tmpl)))
            .then((tmpl) => {
                tmpl.title = tmpl.title || tmplid;
                return Promise.resolve()
                    .then(() => this.checkDependencies(tmpl, reqid, true))
                    .then(() => this.hydrateSchema(tmpl, reqid, true))
                    .then(() => {
                        // Remove IPAM features in official templates if not enabled
                        if (tmplid.split('/')[0] !== 'bigip-fast-templates') {
                            return Promise.resolve();
                        }

                        return this.removeIpamProps(tmpl, reqid);
                    })
                    .then(() => tmpl);
            });
    }

    /**
     * Render Templates
     * @param {number} reqid - FASTWorker process id, identifying the request
     * @param {Object[]} data - array of Template objects to Render
     * @returns {Promise}
     */
    renderTemplates(reqid, data) {
        const appsData = [];
        const lastModified = new Date().toISOString();
        let config = {};
        let appsList = [];
        let promiseChain = Promise.resolve()
            .then(() => this.getConfig(reqid))
            .then((configData) => {
                config = configData;
            })
            .then(() => this.driver.listApplicationNames({ reqid }))
            .then((listData) => {
                appsList = listData.map(x => `${x[0]}/${x[1]}`);
            });

        data.forEach((tmplData) => {
            if (!tmplData.name) {
                promiseChain = promiseChain
                    .then(() => Promise.reject(new Error('name property is missing')));
                return;
            }
            if (!tmplData.parameters) {
                promiseChain = promiseChain
                    .then(() => Promise.reject(new Error('parameters property is missing')));
                return;
            }
            if (typeof tmplData.allowOverwrite === 'undefined') {
                tmplData.allowOverwrite = true;
            }
            const tsData = {};
            const [setName, templateName] = tmplData.name.split('/');
            const ipamAddrs = {};
            promiseChain = promiseChain
                .then(() => {
                    if (!setName || !templateName) {
                        return Promise.reject(new Error(
                            `expected name to be of the form "setName/templateName", but got ${tmplData.name}`
                        ));
                    }
                    return Promise.resolve();
                })
                .then(() => this.recordTransaction(
                    reqid,
                    `fetching template set data for ${setName}`,
                    this.templateProvider.getSetData(setName)
                ))
                .then(setData => Object.assign(tsData, setData))
                .then(() => this.fetchTemplate(reqid, tmplData.name))
                .catch(e => Promise.reject(new Error(`Unable to load template: ${tmplData.name}. ${e.message}`)))
                .then((tmpl) => {
                    const schema = tmpl.getParametersSchema();
                    const ipFromIpamProps = this.getPropsWithChild(schema, 'ipFromIpam', true);
                    return this.ipamProviders.populateIPAMAddress(ipFromIpamProps, tmplData, config, reqid, ipamAddrs)
                        .then(() => tmpl);
                })
                .then(tmpl => this.recordTransaction(
                    reqid,
                    `rendering template (${tmplData.name})`,
                    tmpl.fetchAndRender(tmplData.parameters)
                ))
                .then(rendered => JSON.parse(rendered))
                .then(decl => Promise.resolve()
                    .then(() => this.driver.getTenantAndAppFromDecl(decl))
                    .then(([tenantName, appName]) => `${tenantName}/${appName}`)
                    .then((tenantAndApp) => {
                        if (!tmplData.allowOverwrite && appsList.includes(tenantAndApp)) {
                            return Promise.reject(new Error(
                                `application ${tenantAndApp} already exists and "allowOverwrite" is false`
                            ));
                        }
                        return Promise.resolve();
                    })
                    .then(() => decl))
                .catch(e => Promise.resolve()
                    // Release any IPAM IP addrs
                    .then(() => this.ipamProviders.releaseIPAMAddress(reqid, config, { ipamAddrs }))
                    // Now re-reject
                    .then(() => Promise.reject(new Error(`Failed to render template: ${tmplData.name}. ${e.message}`))))
                .then((decl) => {
                    const templateType = this._returnTemplateType(tsData);
                    const appData = {
                        appDef: decl,
                        metaData: {
                            template: tmplData.name,
                            setHash: tsData.hash,
                            view: tmplData.parameters,
                            templateType,
                            lastModified,
                            ipamAddrs
                        }
                    };
                    appsData.push(appData);

                    const oldAppData = tmplData.previousDef || {};
                    if (oldAppData.ipamAddrs) {
                        return this.ipamProviders.releaseIPAMAddress(reqid, config, oldAppData, ipamAddrs);
                    }

                    return Promise.resolve();
                });
        });

        promiseChain = promiseChain
            .then(() => appsData);

        return promiseChain;
    }

    /**
     * HTTP/REST handlers
     */

    /**
     * record REST Request
     * @param {Object} restOp - restOperation
     * @returns {Promise}
     */
    recordRestRequest(restOp) {
        if (this.driver.userAgent) {
            // Update driver's user agent if one was provided with the request
            const userAgent = restOp.getUri().query.userAgent;
            this.incomingUserAgent = userAgent || '';
            this.driver.userAgent = userAgent ? `${userAgent};${this.baseUserAgent}` : this.baseUserAgent;
        }

        // Update the driver's auth header if one was provided with the request
        if (restOp.headers) {
            const authString = (
                restOp.headers.Authorization
                || restOp.headers.authorization
                || restOp.headers['X-F5-Auth-Token']
                || restOp.headers['x-f5-auth-token']
            );
            if (authString) {
                this.driver.setAuthHeader(authString);
            }
        }

        // Record the time we received the request
        this.requestTimes[restOp.requestId] = Date.now();

        // Dump information to the log
        this.logger.fine(
            `FAST Worker [${restOp.requestId}]: received request method=${restOp.getMethod()}; path=${restOp.getUri().pathname}; userAgent=${this.incomingUserAgent}`
        );

        this.tracer.startSpan(restOp);
    }

    /**
     * record REST Response
     * @param {Object} restOp - restOperation
     * @returns {Promise}
     */
    recordRestResponse(restOp) {
        const minOp = {
            method: restOp.getMethod(),
            path: restOp.getUri().pathname,
            status: restOp.getStatusCode(),
            errorMessage: restOp.stack
        };
        if (minOp.status === 202 && ['Post', 'Patch', 'Delete'].includes(minOp.method) && minOp.path.includes('/shared/fast/applications')) {
            minOp.task = restOp.getBody().message.map(x => x.id).pop();
        }
        if (process.env.NODE_ENV === 'development') {
            minOp.body = restOp.getBody();
        }
        const dt = Date.now() - this.requestTimes[restOp.requestId];
        const msg = `FAST Worker [${restOp.requestId}]: sending response after ${dt}ms\n${JSON.stringify(minOp, null, 2)}`;
        delete this.requestTimes[restOp.requestId];
        if (minOp.status >= 400) {
            this.logger.info(msg);
        } else {
            this.logger.fine(msg);
        }

        this.tracer.endSpan(restOp);
    }

    /**
     * generate Response for REST Request
     * @param {Object} restOperation
     * @param {number} code - status code for Response
     * @param {string} message - message sent with Response
     * @param {string} stack - stack trace if error
     * @returns {Promise}
     */
    genRestResponse(restOperation, code, message, stack) {
        let doParse = false;
        if (typeof message !== 'string') {
            message = JSON.stringify(message, null, 2);
            doParse = true;
        }
        message = message
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        if (doParse) {
            message = JSON.parse(message);
        }
        restOperation.setStatusCode(code);
        restOperation.setBody({
            code,
            requestId: restOperation.requestId,
            message
        });
        if (stack) {
            restOperation.stack = stack;
        }
        this.completeRestOperation(restOperation);
        if (code >= 400) {
            this.generateTeemReportError(restOperation);
            this.tracer.logError(restOperation, message);
        }
        return Promise.resolve();
    }

    /**
     * GET FAST config Settings and AS3 Driver data
     * @param {Object} restOperation
     * @returns {Promise}
     */
    getInfo(restOperation) {
        return Promise.resolve()
            .then(() => this.gatherInfo(restOperation.requestId))
            .then((info) => {
                restOperation.setBody(info);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 500, 'Internal Error: Could not gather info.', e.stack));
    }

    /**
     * GET Template by name
     * @param {Object} restOperation
     * @param {string} tmplid - name of Template
     * @returns {Promise}
     */
    getTemplates(restOperation, tmplid) {
        const reqid = restOperation.requestId;
        if (tmplid) {
            const pathElements = _getPathElements(restOperation);
            tmplid = `${pathElements.itemId}/${pathElements.itemSubId}`;

            return Promise.resolve()
                .then(() => this.fetchTemplate(reqid, tmplid))
                .then((tmpl) => {
                    restOperation.setBody(tmpl);
                    this.completeRestOperation(restOperation);
                })
                .catch((e) => {
                    if (e.message.match(/Could not find template/)) {
                        return this.genRestResponse(restOperation, 404, `Client Error: Could not find template ${tmplid}`, e.stack);
                    }
                    return this.genRestResponse(restOperation, 400, `Client Error: Could not load template ${tmplid}`, e.stack);
                });
        }

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid,
                'fetching template list',
                this.templateProvider.list()
                    .then(tmplList => this.filterTemplates(tmplList))
            ))
            .then((templates) => {
                restOperation.setBody(templates);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 500, 'Internal Error: Could not fetch templates list', e.stack));
    }

    /**
     * GET Applications
     * @param {Object} restOperation
     * @param {string} appid - name of Applications to GET
     * @returns {Promise}
     */
    getApplications(restOperation, appid) {
        const reqid = restOperation.requestId;
        if (appid) {
            const pathElements = _getPathElements(restOperation);
            const tenant = pathElements.itemId;
            const app = pathElements.itemSubId;
            return Promise.resolve()
                .then(() => this.recordTransaction(
                    reqid,
                    'GET request to appsvcs/declare',
                    this.driver.getRawDeclaration({ reqid })
                ))
                .then(resp => resp.data[tenant][app])
                .then(appDef => this.migrateLegacyApps(restOperation, [appDef]))
                .then((appDefs) => {
                    restOperation.setBody(appDefs[0]);
                    this.completeRestOperation(restOperation);
                })
                .catch(e => this.genRestResponse(restOperation, 404, `Client Error: Could not find application ${tenant}/${app}`, e.stack));
        }

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid,
                'gathering a list of applications from the driver',
                this.driver.listApplications({ reqid })
            ))
            .then(appsList => this.migrateLegacyApps(restOperation, appsList))
            .then((appsList) => {
                restOperation.setBody(appsList);
                this.completeRestOperation(restOperation);
            });
    }

    /**
     * GET Tasks
     * @param {Object} restOperation
     * @param {string} taskid - Task ID to GET
     * @returns {Promise}
     */
    getTasks(restOperation, taskid) {
        const reqid = restOperation.requestId;
        if (taskid) {
            return Promise.resolve()
                .then(() => this.recordTransaction(
                    reqid,
                    'gathering a list of tasks from the driver',
                    this.driver.getTasks({ reqid })
                ))
                .then(taskList => taskList.filter(x => x.id === taskid))
                .then((taskList) => {
                    if (taskList.length === 0) {
                        return this.genRestResponse(restOperation, 404, `Client Error: Unknown task ID: ${taskid}`, undefined);
                    }
                    restOperation.setBody(taskList[0]);
                    this.completeRestOperation(restOperation);
                    return Promise.resolve();
                })
                .catch(e => this.genRestResponse(restOperation, 500, `Internal Error: Could not get task ${taskid}`, e.stack));
        }

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid,
                'gathering a list of tasks from the driver',
                this.driver.getTasks({ reqid })
            ))
            .then((tasksList) => {
                restOperation.setBody(tasksList);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 500, 'Internal Error: Could not get tasks list', e.stack));
    }

    /**
     * GET Template Sets
     * @param {Object} restOperation
     * @param {string} tsid - name of Template Set to get
     * @returns {Promise}
     */
    getTemplateSets(restOperation, tsid) {
        const queryParams = restOperation.getUri().query;
        const showDisabled = queryParams.showDisabled || false;
        const reqid = restOperation.requestId;
        if (tsid) {
            return Promise.resolve()
                .then(() => this.getConfig(reqid))
                .then(config => this.recordTransaction(
                    reqid,
                    'gathering a template set',
                    this.gatherTemplateSet(reqid, tsid, config)
                ))
                .then((tmplSet) => {
                    restOperation.setBody(tmplSet);
                    if (tmplSet.error) {
                        return Promise.reject(new Error(tmplSet.error));
                    }
                    this.completeRestOperation(restOperation);
                    return Promise.resolve();
                })
                .catch((e) => {
                    if (e.message.match(/No templates found/) || e.message.match(/does not exist/)) {
                        return this.genRestResponse(restOperation, 404, e.message, undefined);
                    }
                    return this.genRestResponse(restOperation, 500, `Internal Error: Could not get templateset ${tsid}`, e.stack);
                });
        }

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid,
                'gathering a list of template sets',
                this.templateProvider.listSets()
            ))
            .then(setList => Promise.all([
                Promise.resolve(setList),
                this.getConfig(reqid),
                this.recordTransaction(
                    reqid,
                    'gathering a list of applications from the driver',
                    this.driver.listApplications({ reqid })
                )
            ]))
            .then(([setList, config, appsList]) => this.recordTransaction(
                reqid,
                'gathering data for each template set',
                Promise.all(setList.map(x => this.gatherTemplateSet(reqid, x, config, appsList)))
            ))
            .then(setList => setList.filter(x => x.enabled === !showDisabled))
            .then((setList) => {
                restOperation.setBody(setList);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 500, 'Internal Error: Could not get templatesets list', e.stack));
    }

    /**
     * GET FAST's Global-Settings config
     * @param {Object} restOperation
     * @returns {Promise}
     */
    getSettings(restOperation) {
        const reqid = restOperation.requestId;
        return Promise.resolve()
            .then(() => this.getConfig(reqid))
            .then((config) => {
                const retVal = Object.assign({}, config);
                Object.keys(retVal).forEach((key) => {
                    // Remove any "private" keys
                    if (key.startsWith('_')) {
                        delete retVal[key];
                    }
                });
                restOperation.setBody(retVal);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 500, 'Internal Error: Could not get settings', e.stack));
    }

    /**
     * GET FASTWorker's config Settings Schema
     * @param {Object} restOperation
     * @returns {Promise}
     */
    getSettingsSchema(restOperation) {
        return Promise.resolve()
            .then(() => {
                const schema = this.getConfigSchema();
                restOperation.setBody(schema);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 500, 'Internal Error: Could not get settings schema', e.stack));
    }

    /**
     * GET Request handler
     * @param {Object} restOperation
     * @returns {Promise}
     */
    onGet(restOperation) {
        const pathElements = _getPathElements(restOperation);
        const collection = pathElements.collection;
        const itemid = pathElements.itemId;

        restOperation.requestId = this.generateRequestId();
        this.recordRestRequest(restOperation);

        return Promise.resolve()
            .then(() => this.handleLazyInit(restOperation.requestId))
            .then(() => this.validateRequest(restOperation))
            .then(() => {
                try {
                    switch (collection) {
                    case 'info':
                        return this.getInfo(restOperation);
                    case 'templates':
                        return this.getTemplates(restOperation, itemid);
                    case 'applications':
                        return this.getApplications(restOperation, itemid);
                    case 'tasks':
                        return this.getTasks(restOperation, itemid);
                    case 'templatesets':
                        return this.getTemplateSets(restOperation, itemid);
                    case 'settings':
                        return this.getSettings(restOperation);
                    case 'settings-schema':
                        return this.getSettingsSchema(restOperation);
                    default:
                        return this.genRestResponse(restOperation, 404, `Client Error: unknown endpoint ${pathElements.pathname}`, undefined);
                    }
                } catch (e) {
                    return this.genRestResponse(restOperation, 500, 'Internal Error: Failed to process get request', e.stack);
                }
            })
            .catch(e => this.genRestResponse(restOperation, 400, e.message, undefined));
    }

    /**
     * POST Applications
     * @param {Object} restOperation
     * @param {Object[]} data - array of Application to create
     * @returns {Promise}
     */
    postApplications(restOperation, data) {
        const reqid = restOperation.requestId;
        if (!Array.isArray(data)) {
            data = [data];
        }

        // this.logger.info(`postApplications() received:\n${JSON.stringify(data, null, 2)}`);
        let appsData;

        return Promise.resolve()
            .then(() => this.renderTemplates(reqid, data))
            .catch((e) => {
                let code = 400;
                if (e.message.match(/Could not find template/)) {
                    code = 404;
                }

                return Promise.reject(this.genRestResponse(restOperation, code, e.message, e.stack));
            })
            .then((renderResults) => {
                appsData = renderResults;
            })
            .then(() => {
                appsData.forEach((appData) => {
                    this.generateTeemReportApplication('modify', appData.metaData.template, appData.metaData.templateType);
                });
            })
            .then(() => this.recordTransaction(
                reqid,
                'requesting new application(s) from the driver',
                this.driver.createApplications(appsData, { reqid })
            ))
            .catch((e) => {
                if (restOperation.getStatusCode() >= 400) {
                    return Promise.reject();
                }
                const code = (e.response) ? e.response.status : 500;
                return this.releaseIPAMAddressesFromApps(reqid, appsData)
                    .then(() => Promise.reject(this.genRestResponse(
                        restOperation,
                        code,
                        `Error: Could not generate AS3 declaration: ${e.message}`,
                        e.stack
                    )));
            })
            .then((response) => {
                if (response.status >= 300) {
                    return this.genRestResponse(restOperation, response.status, response.body, undefined);
                }
                return this.genRestResponse(restOperation, response.status, data.map(
                    x => ({
                        id: response.body.id,
                        name: x.name,
                        parameters: x.parameters
                    })
                ), undefined);
            })
            .catch((e) => {
                if (restOperation.getStatusCode() < 400) {
                    this.genRestResponse(restOperation, 500, `Internal Error: Could not create applications: ${e.message}`, e.stack);
                }
            });
    }

    /**
     * validate Template Set
     * @param {string} tsRoot - a path to a directory containing template set directories
     * @param {string[]} tsFilter - only load template sets in this list (or all if list is empty)
     * @returns {Promise}
     */
    _validateTemplateSet(tsRoot, tsFilter) {
        const tmplProvider = new FsTemplateProvider(tsRoot, tsFilter);
        return tmplProvider.list()
            .then((templateList) => {
                if (templateList.length === 0) {
                    return Promise.reject(new Error('template set contains no templates'));
                }
                return Promise.resolve(templateList);
            })
            .then(templateList => Promise.all(templateList.map(tmpl => tmplProvider.fetch(tmpl))));
    }

    /**
     * get link to compressed Template Set download
     * @param {Object} data - Template Set configuration
     * @returns {Promise}
     */
    _getTsUrl(data) {
        if (data.gitHubRepo) {
            return `https://github.com/${data.gitHubRepo}/archive/${data.gitRef}.zip`;
        }
        if (data.gitLabRepo) {
            data.gitLabUrl = data.gitLabUrl || 'https://gitlab.com';
            const encodedRepo = data.gitLabRepo.replaceAll('/', '%2F');
            return `${data.gitLabUrl}/api/v4/projects/${encodedRepo}/repository/archive.zip?sha=${data.gitRef}`;
        }
        return undefined;
    }

    /**
     * create local Template Set zip file from Git
     * @param {string} tsUrl - location of Template Set in Git
     * @param {string} setpath - path to file being created
     * @param {Object} data - Template Set configuration
     * @param {number} reqid - FASTWorker process id, identifying the request
     * @returns {Promise}
     */
    _fetchTsFromGit(tsUrl, setpath, data, reqid) {
        return Promise.resolve()
            .then(() => (data.gitToken ? this.secretsManager.decrypt(data.gitToken) : Promise.resolve()))
            .then((gitToken) => {
                const reqConf = {
                    responseType: 'stream'
                };
                if (data.gitToken) {
                    if (data.gitHubRepo) {
                        reqConf.headers = {
                            authorization: `token ${gitToken}`
                        };
                    } else if (data.gitLabRepo) {
                        reqConf.headers = {
                            authorization: `Bearer ${gitToken}`
                        };
                    }
                }
                return this.recordTransaction(
                    reqid,
                    `fetch template set from url (${tsUrl})`,
                    axios.get(tsUrl, reqConf)
                        .catch(e => this.handleResponseError(e, `fetching ${tsUrl}`))
                        .then(resp => new Promise((resolve, reject) => {
                            const stream = fs.createWriteStream(setpath);
                            resp.data.pipe(stream);
                            stream.on('finish', resolve);
                            stream.on('error', reject);
                        }))
                );
            });
    }

    /**
     * create directory for validating Template Set
     * @param {number} reqId - FASTWorker process id, identifying the request
     * @param {string} scratch - path to temp dir for validating Template Set
     * @returns {Promise}
     */
    _scratchDirectoryForValidation(reqId, scratch) {
        // Setup a scratch location we can use while validating the template set
        this.enterTransaction(reqId, 'prepare scratch space');
        fs.removeSync(scratch);
        fs.mkdirsSync(scratch);
        this.exitTransaction(reqId, 'prepare scratch space');
    }

    /**
     * get Template Set type
     * @param {Object} data - Template Set configuration
     * @returns {Promise}
     */
    _returnTemplateType(data) {
        let templateType = 'local';
        if (data.gitHubRepo) {
            templateType = 'GitHub';
        } else if (data.gitLabRepo) {
            templateType = 'GitLab';
        }
        return templateType;
    }

    /**
     * POST Template Set
     * @param {Object} restOperation
     * @param {Object} data - Template Set configuration
     * @returns {Promise}
     */
    postTemplateSets(restOperation, data) {
        const reqid = restOperation.requestId;

        if (!data.name && !data.gitHubRepo && !data.gitLabRepo) {
            return this.genRestResponse(restOperation, 400, 'Client Error: Must supply one of the following parameters: name, gitHubRepo, gitLabRepo', undefined);
        }

        data.gitRef = data.gitRef || 'main';
        data.gitUpdateAvailable = false;

        const tsid = data.name
            || data.gitSubDir
            || (data.gitHubRepo ? data.gitHubRepo.split('/')[1] : null)
            || (data.gitLabRepo ? data.gitLabRepo.split('/')[1] : null);
        const templateType = this._returnTemplateType(data);
        const setsrc = (this.uploadPath !== '') ? `${this.uploadPath}/${tsid}.zip` : `${tsid}.zip`;
        const scratch = `${this.scratchPath}/${tsid}`;
        const tsRootPath = this.scratchPath;
        const tsFilter = [tsid];
        const onDiskPath = `${this.templatesPath}/${tsid}`;
        const extractSubDir = data.gitSubDir;
        let zipFileDigestHash;

        this._scratchDirectoryForValidation(reqid, scratch);
        return Promise.resolve()
            .then(() => {
                if (data.gitHubRepo || data.gitLabRepo) {
                    if (data.gitToken) {
                        data.unprotected = false;
                        return this.secretsManager.encrypt(data.gitToken);
                    }
                    if (!data.gitToken && !data.unprotected) {
                        return Promise.reject(
                            new Error('Must set "unprotected" boolean property to true to install publicly available templatesets')
                        );
                    }
                }

                return Promise.resolve();
            })
            .then((protectedGitToken) => {
                if (data.gitToken) {
                    data.gitToken = protectedGitToken;
                }
                if (fs.existsSync(onDiskPath)) {
                    return this.recordTransaction(
                        reqid,
                        'copy template set from disk',
                        fs.copy(onDiskPath, scratch)
                    );
                }

                const setpath = `${scratch}.zip`;
                return Promise.resolve()
                    .then(() => {
                        const tsUrl = this._getTsUrl(data);
                        if (tsUrl) {
                            return this._fetchTsFromGit(tsUrl, setpath, data, reqid);
                        }
                        return this.recordTransaction(
                            reqid,
                            'fetch uploaded template set',
                            this.bigip.copyUploadedFile(setsrc, setpath)
                        );
                    })
                    .then(() => this.recordTransaction(
                        reqid,
                        'extract template set',
                        new Promise((resolve, reject) => {
                            extract(setpath, { dir: scratch }, (err) => {
                                if (err) return reject(err);
                                return resolve();
                            });
                        })
                    ));
            })
            .then(() => new Promise((resolve, reject) => {
                if (data.gitHubRepo || data.gitLabRepo) {
                    const zipFileHash = crypto.createHash('sha256');
                    const input = fs.createReadStream(`${scratch}.zip`);
                    input.on('error', reject);
                    input.on('data', (chunk) => {
                        zipFileHash.update(chunk);
                    });
                    input.on('close', () => {
                        zipFileDigestHash = zipFileHash.digest('hex');
                        resolve();
                    });
                } else {
                    resolve();
                }
            }))
            .then(() => {
                const files = fs.readdirSync(scratch);
                let numFiles = 0;
                let numDirs = 0;
                let lastDir = null;

                files.forEach((file) => {
                    const path = `${scratch}/${file}`;
                    const stats = fs.statSync(path);
                    if (stats.isFile()) {
                        numFiles += 1;
                    }
                    if (stats.isDirectory()) {
                        numDirs += 1;
                        lastDir = path;
                    }
                });

                if (numDirs === 1 && numFiles === 0) {
                    // Directory was zipped instead of its contents
                    const subFiles = fs.readdirSync(lastDir);
                    subFiles.forEach((file) => {
                        fs.moveSync(`${lastDir}/${file}`, `${scratch}/${file}`);
                    });
                    fs.removeSync(lastDir);
                }

                if (extractSubDir) {
                    const subDirTemp = `${this.scratchPath}/__fast_tmp__`;
                    fs.removeSync(subDirTemp);
                    fs.moveSync(`${scratch}/${extractSubDir}`, subDirTemp);
                    fs.removeSync(scratch);
                    fs.moveSync(subDirTemp, scratch);
                }
            })
            .then(() => this.recordTransaction(
                reqid,
                'validate template set',
                this._validateTemplateSet(tsRootPath, tsFilter)
                    .catch(e => Promise.reject(
                        new Error(`Template set (${tsid}) failed validation: ${e.message}. ${e.stack}`)
                    ))
            ))
            .then(() => this.enterTransaction(reqid, 'write new template set to data store'))
            .then(() => this.templateProvider.invalidateCache())
            .then(() => DataStoreTemplateProvider.fromFs(this.storage, tsRootPath, tsFilter))
            .then(() => this.generateTeemReportTemplateSet('create', tsid, templateType))
            .then(() => this.getConfig(reqid))
            .then((config) => {
                // If we are installing a template set from GitHub, record some extra information for later
                if (data.gitHubRepo || data.gitLabRepo) {
                    config._gitTemplateSets[tsid] = {};
                    Object.keys(data).forEach((key) => {
                        const copyKey = (
                            key.startsWith('git')
                        );
                        if (copyKey) {
                            config._gitTemplateSets[tsid][key] = data[key];
                        }
                        config._gitTemplateSets[tsid].unprotected = data.unprotected;
                    });
                    config._gitTemplateSets[tsid].gitZipFileInfo = {
                        hash: zipFileDigestHash,
                        date: new Date()
                    };
                }

                // If we are installing a delete template set, remove it from the deleted list
                if (config.deletedTemplateSets.includes(tsid)) {
                    config.deletedTemplateSets = config.deletedTemplateSets.filter(x => x !== tsid);
                }

                return this.saveConfig(config, reqid);
            })
            .then((persisted) => {
                // if both template and config storage are data-group based, avoid calling persist() twice
                // saveConfig() already calls persist() and triggers save sys config, which can cause latency
                if (persisted && this.storage instanceof StorageDataGroup
                    && this.configStorage instanceof StorageDataGroup) {
                    return Promise.resolve();
                }
                return this.storage.persist();
            })
            .then(() => this.exitTransaction(reqid, 'write new template set to data store'))
            .then(() => {
                if (tsid !== 'bigip-fast-templates') {
                    return Promise.resolve();
                }
                // Automatically convert any apps using the old pool_members definition
                return this.recordTransaction(
                    reqid,
                    'converting applications with old wide ip and/or pool_members definition',
                    this.driver.listApplications({ reqid })
                        .then(apps => this.migrateLegacyApps(reqid, apps))
                );
            })
            .then(() => this.genRestResponse(restOperation, 200, '', undefined))
            .catch((e) => {
                if (e.message.match(/no such file/)) {
                    return this.genRestResponse(restOperation, 404, `Client Error: ${setsrc} does not exist`, undefined);
                }
                if (e.message.match(/failed fetching/)) {
                    return this.genRestResponse(restOperation, 404, e.message, e.stack);
                }
                if (e.message.match(/failed validation/)) {
                    return this.genRestResponse(restOperation, 400, e.message, e.stack);
                }
                if (e.message.match(/Must set "unprotected" boolean property/)) {
                    return this.genRestResponse(restOperation, 422, e.message, e.stack);
                }
                return this.genRestResponse(restOperation, 500, e.message, e.stack);
            })
            .finally(() => fs.removeSync(scratch));
    }

    /**
     * POST FASTWorker Settings
     * @param {Object} restOperation
     * @param {Object} config - FASTWorker Settings configuration
     * @returns {Promise}
     */
    postSettings(restOperation, config) {
        const reqid = restOperation.requestId;

        return Promise.resolve()
            .then(() => this.validateConfig(config))
            .catch(e => Promise.reject(this.genRestResponse(
                restOperation,
                422,
                `Client Error: Supplied settings were not valid:\n${e.message}`,
                e.stack
            )))
            .then(() => this.encryptConfigSecrets(config))
            .then(() => this.saveConfig(config, reqid))
            .then(() => Promise.resolve(this.tracer.setOptions(this.deviceInfo, this.as3Info, config.perfTracing)))
            .then(() => this.genRestResponse(restOperation, 200, '', undefined))
            .catch((e) => {
                if (restOperation.getStatusCode() < 400) {
                    this.genRestResponse(restOperation, 500, e.message, e.stack);
                }
            });
    }

    /**
     * POST to Render Templates
     * @param {Object} restOperation
     * @param {Object[]} config - array of Template objects to Render
     * @returns {Promise}
     */
    postRender(restOperation, data) {
        const reqid = restOperation.requestId;
        if (!Array.isArray(data)) {
            data = [data];
        }

        // this.logger.info(`postRender() received:\n${JSON.stringify(data, null, 2)}`);

        return Promise.resolve()
            .then(() => this.renderTemplates(reqid, data))
            .catch((e) => {
                let code = 400;
                if (e.message.match(/Could not find template/)) {
                    code = 404;
                }
                return Promise.reject(this.genRestResponse(restOperation, code, e.message, e.stack));
            })
            .then(rendered => this.releaseIPAMAddressesFromApps(reqid, rendered)
                .then(() => rendered))
            .then(rendered => this.genRestResponse(restOperation, 200, rendered, undefined))
            .catch((e) => {
                if (restOperation.getStatusCode() < 400) {
                    this.genRestResponse(restOperation, 500, e.message, e.stack);
                }
            });
    }

    /**
     * POST new OffBox Template Set
     * @param {Object} restOperation
     * @param {Object} data - config for new OffBox Template Set
     * @returns {Promise}
     */
    postOffBoxTemplates(restOperation, data) {
        const reqid = restOperation.requestId;
        return Promise.resolve()
            .then(() => this.getConfig(reqid))
            .then((config) => {
                const promises = [];
                data.methods.forEach((method) => {
                    if (method.name === 'status') {
                        promises.push(this._checkOffboxTemplatesStatus(reqid, config));
                    }
                });
                return Promise.all(promises);
            })
            .then(() => {
                restOperation.setBody({
                    code: 201,
                    requestId: reqid,
                    methods: data.methods
                });
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.message, e.stack));
    }

    /**
     * update config with any new OffBox Template Sets
     * @param {number} reqid - FASTWorker process id, identifying the request
     * @param {Object} config - object containing the FASTWorker config Settings
     * @returns {Promise}
     */
    _checkOffboxTemplatesStatus(reqid, config) {
        const foundGitRepos = [];
        const scratchGit = `${this.scratchPath}/git/`;
        this._scratchDirectoryForValidation(reqid, scratchGit);
        return this.recordTransaction(
            reqid,
            'gathering a list of template sets',
            this.templateProvider.listSets()
        )
            .then((setList) => {
                const promises = [];
                if (config._gitTemplateSets) {
                    setList.forEach((templateSetName) => {
                        if (config._gitTemplateSets[templateSetName]) {
                            foundGitRepos.push({
                                name: templateSetName,
                                info: config._gitTemplateSets[templateSetName]
                            });
                            const tsUrl = this._getTsUrl(config._gitTemplateSets[templateSetName]);
                            if (tsUrl) {
                                const setpath = `${scratchGit}${templateSetName}.zip`;
                                promises.push(this._fetchTsFromGit(
                                    tsUrl,
                                    setpath,
                                    config._gitTemplateSets[templateSetName],
                                    reqid
                                ));
                            }
                        }
                    });
                }
                return Promise.all(promises);
            })
            .then(() => {
                const promises = [];
                if (foundGitRepos.length) {
                    foundGitRepos.forEach((gitRepo) => {
                        promises.push(this._generateGitRepoHashValue(`${scratchGit}${gitRepo.name}.zip`));
                    });
                }
                return Promise.all(promises);
            })
            .then((results) => {
                foundGitRepos.forEach((gitRepo, index) => {
                    if (gitRepo.info.gitZipFileInfo.hash !== results[index]) {
                        config._gitTemplateSets[gitRepo.name].gitUpdateAvailable = true;
                    } else {
                        config._gitTemplateSets[gitRepo.name].gitUpdateAvailable = false;
                    }
                });
                return this.saveConfig(config, reqid);
            });
    }

    /**
     * get hash for OffBox Template Set
     * @param {string} zipFileName - location of zipped OffBox Template Set
     * @returns {Promise}
     */
    _generateGitRepoHashValue(zipFileName) {
        return new Promise((resolve, reject) => {
            const zipFileHash = crypto.createHash('sha256');
            const input = fs.createReadStream(zipFileName);
            input.on('error', reject);
            input.on('data', (chunk) => {
                zipFileHash.update(chunk);
            });
            input.on('close', () => {
                resolve(zipFileHash.digest('hex'));
            });
        });
    }

    /**
     * PUT Request handler
     * @param {Object} restOperation
     * @returns {Promise}
     */
    onPut(restOperation) {
        return this.onPost(restOperation);
    }

    /**
     * POST Request handler
     * @param {Object} restOperation
     * @returns {Promise}
     */
    onPost(restOperation) {
        const body = restOperation.getBody();
        const pathElements = _getPathElements(restOperation);
        const collection = pathElements.collection;
        restOperation.requestId = this.generateRequestId();

        this.recordRestRequest(restOperation);

        return Promise.resolve()
            .then(() => this.handleLazyInit(restOperation.requestId))
            .then(() => this.validateRequest(restOperation))
            .then(() => {
                try {
                    switch (collection) {
                    case 'applications':
                        return this.postApplications(restOperation, body);
                    case 'templatesets':
                        return this.postTemplateSets(restOperation, body);
                    case 'settings':
                        return this.postSettings(restOperation, body);
                    case 'render':
                        return this.postRender(restOperation, body);
                    case 'offbox-templatesets':
                        return this.postOffBoxTemplates(restOperation, body);
                    default:
                        return this.genRestResponse(restOperation, 404, `Client Error: Unknown endpoint ${pathElements.pathname}`, undefined);
                    }
                } catch (e) {
                    return this.genRestResponse(restOperation, 500, e.message, e.stack);
                }
            })
            .catch(e => this.genRestResponse(restOperation, 400, e.message, e.stack));
    }

    /**
     * DELETE FAST Applications
     * @param {Object} restOperation
     * @param {string} appid - name of Application to delete
     * @param {Object} data - configuration of the Application being deleted
     * @returns {Promise}
     */
    deleteApplications(restOperation, appid, data) {
        const reqid = restOperation.requestId;
        const pathElements = _getPathElements(restOperation);

        if (appid) {
            data = [`${pathElements.itemId}/${pathElements.itemSubId}`];
        } else if (!data) {
            data = [];
        }

        if (typeof data === 'string') {
            // convert empty string to an empty array
            data = [];
        }

        let appNames = null;
        try {
            appNames = data.map(x => x.split('/'));
        } catch (e) {
            return Promise.reject(new Error(`Incorrect app info provided: ${JSON.stringify(data)}`));
        }

        const badAppNames = appNames
            .filter(appName => appName.length !== 2)
            .map(appName => appName.join('/'));

        if (badAppNames.length !== 0) {
            return Promise.reject(new Error(
                `Invalid application name(s) supplied: ${badAppNames.join(',')}`
            ));
        }

        let appsData;

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid,
                'requesting application data from driver',
                Promise.all(appNames.map(x => this.driver.getApplication(...x, { reqid })))
            ))
            .then((value) => {
                appsData = value;
            })
            .then(() => this.releaseIPAMAddressesFromApps(reqid, appsData))
            .then(() => this.recordTransaction(
                reqid,
                'deleting applications',
                this.driver.deleteApplications(appNames, { reqid })
            ))
            .then((result) => {
                const body = Object.assign(
                    {},
                    result.data, // for backwards compatibility
                    {
                        code: result.status,
                        requestId: reqid,
                        message: appNames.map(() => ({
                            id: result.data.id
                        }))
                    }
                );
                if (body.message.length === 0) {
                    // Handle delete all
                    body.message.push({ id: result.data.id });
                }

                // Cannot use genRestResponse() since we have extra items in the body for backwards compatibility
                restOperation.setStatusCode(result.status);
                restOperation.setBody(body);
                this.completeRestOperation(restOperation);
            })
            .then(() => {
                appsData.forEach((appData) => {
                    this.generateTeemReportApplication('delete', appData.template);
                });
            })
            .catch((e) => {
                if (e.message.match('no tenant found')) {
                    return this.genRestResponse(restOperation, 404, e.message, e.stack);
                }
                if (e.message.match('could not find application')) {
                    return this.genRestResponse(restOperation, 404, e.message, e.stack);
                }
                if (e.message.match('Invalid application name')) {
                    return this.genRestResponse(restOperation, 400, e.message, e.stack);
                }
                if (e.message.match('Incorrect app info provided')) {
                    return this.genRestResponse(restOperation, 400, e.message, e.stack);
                }
                return this.genRestResponse(restOperation, 500, e.message, e.stack);
            });
    }

    /**
     * DELETE FAST Template Sets
     * @param {Object} restOperation
     * @param {string} tsid - name of Template Set to delete
     * @returns {Promise}
     */
    deleteTemplateSets(restOperation, tsid) {
        const reqid = restOperation.requestId;
        if (tsid) {
            let config;
            return Promise.resolve()
                .then(() => this.getConfig(reqid)
                    .then((data) => { config = data; }))
                .then(() => this.recordTransaction(
                    reqid,
                    'gathering a list of applications from the driver',
                    this.driver.listApplications({ reqid })
                ))
                .then(appsList => this.recordTransaction(
                    reqid,
                    `gathering template set data for ${tsid}`,
                    this.gatherTemplateSet(reqid, tsid, config, appsList)
                ))
                .then((setData) => {
                    const usedBy = setData.templates.reduce((acc, curr) => {
                        acc.push(...curr.appsList);
                        return acc;
                    }, []);
                    if (usedBy.length > 0) {
                        return Promise.reject(
                            new Error(`Cannot delete template set ${tsid}, it is being used by:\n${JSON.stringify(usedBy)}`)
                        );
                    }
                    return Promise.resolve();
                })
                .then(() => this.recordTransaction(
                    reqid,
                    'deleting a template set from the data store',
                    this.templateProvider.removeSet(tsid)
                        .catch((e) => {
                            if (e.message && e.message.match(/Set removal not implemented/)) {
                                // Tried deleting FS template
                                return Promise.resolve();
                            }

                            return Promise.reject(e);
                        })
                ))
                .then(() => {
                    config.deletedTemplateSets.push(tsid);
                    delete config._gitTemplateSets[tsid];
                })
                .then((persisted) => {
                    this.generateTeemReportTemplateSet('delete', tsid);
                    if (persisted && this.storage instanceof StorageDataGroup
                        && this.configStorage instanceof StorageDataGroup) {
                        return Promise.resolve();
                    }
                    return this.recordTransaction(
                        reqid,
                        'persisting the data store',
                        this.storage.persist()
                    );
                })
                .then(() => this.genRestResponse(restOperation, 200, 'success', undefined))
                .catch((e) => {
                    if (e.message.match(/Could not find template set/)) {
                        return this.genRestResponse(restOperation, 404, e.message, e.stack);
                    }
                    if (e.message.match(/being used by/)) {
                        return this.genRestResponse(restOperation, 400, e.message, e.stack);
                    }
                    return this.genRestResponse(restOperation, 500, e.message, e.stack);
                });
        }

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid,
                'gathering a list of template sets',
                this.templateProvider.listSets()
            ))
            .then((setList) => {
                let promiseChain = Promise.resolve();
                setList.forEach((set) => {
                    promiseChain = promiseChain
                        .then(() => this.recordTransaction(
                            reqid,
                            `deleting template set: ${set}`,
                            this.templateProvider.removeSet(set)
                                .catch((e) => {
                                    if (e.message && e.message.match(/Set removal not implemented/)) {
                                        // Tried deleting FS template
                                        return Promise.resolve();
                                    }

                                    return Promise.reject(e);
                                })
                        ));
                });
                return promiseChain
                    .then(() => this.getConfig(reqid))
                    .then((config) => {
                        config.deletedTemplateSets = [...new Set(config.deletedTemplateSets.concat(setList))];
                        return this.saveConfig(config, reqid);
                    })
                    .then((persisted) => {
                        if (persisted && this.storage instanceof StorageDataGroup
                            && this.configStorage instanceof StorageDataGroup) {
                            return Promise.resolve();
                        }
                        return this.recordTransaction(
                            reqid,
                            'persisting the data store',
                            this.storage.persist()
                        );
                    });
            })
            .then(() => this.genRestResponse(restOperation, 200, 'success', undefined))
            .catch(e => this.genRestResponse(restOperation, 500, e.message, e.stack));
    }

    /**
     * DELETE FASTWorker config Settings
     * @param {Object} restOperation
     * @returns {Promise}
     */
    deleteSettings(restOperation) {
        const reqid = restOperation.requestId;
        const defaultConfig = this._getDefaultConfig();
        return Promise.resolve()
            // delete the datagroup;
            .then(() => this.configStorage.deleteItem(configKey))
            // save the default config to create the config datagroup
            .then(() => this.saveConfig(defaultConfig, reqid))
            .then(() => (this.configStorage instanceof StorageDataGroup
                ? Promise.resolve() : this.configStorage.persist()))
            .then(() => this.genRestResponse(restOperation, 200, 'success', undefined))
            .catch(e => this.genRestResponse(restOperation, 500, e.message, e.stack));
    }

    /**
     * DELETE Request handler
     * @param {Object} restOperation
     * @returns {Promise}
     */
    onDelete(restOperation) {
        const body = restOperation.getBody();
        const pathElements = _getPathElements(restOperation);
        const collection = pathElements.collection;
        const itemid = pathElements.itemId;

        restOperation.requestId = this.generateRequestId();

        this.recordRestRequest(restOperation);

        return Promise.resolve()
            .then(() => this.handleLazyInit(restOperation.requestId))
            .then(() => this.validateRequest(restOperation))
            .then(() => {
                try {
                    switch (collection) {
                    case 'applications':
                        return this.deleteApplications(restOperation, itemid, body);
                    case 'templatesets':
                        return this.deleteTemplateSets(restOperation, itemid);
                    case 'settings':
                        return this.deleteSettings(restOperation);
                    default:
                        return this.genRestResponse(restOperation, 404, `Client Error: Unknown endpoint ${pathElements.pathname}`, undefined);
                    }
                } catch (e) {
                    return this.genRestResponse(restOperation, 500, e.message, e.stack);
                }
            })
            .catch(e => this.genRestResponse(restOperation, 400, e.message, e.stack));
    }

    /**
     * modify FAST Applications
     * @param {Object} restOperation
     * @param {string} appid - name of Application to modify
     * @param {Object} data - new Application configuration
     * @returns {Promise}
     */
    patchApplications(restOperation, appid, data) {
        if (!appid) {
            return Promise.resolve()
                .then(() => this.genRestResponse(restOperation, 400, 'Client Error: PATCH is not supported on this endpoint', undefined));
        }
        const reqid = restOperation.requestId;
        const pathElements = _getPathElements(restOperation);
        const tenant = pathElements.itemId;
        const app = pathElements.itemSubId;
        const newParameters = data.parameters;
        // clone restOp, but make sure to unhook complete op
        const postOp = Object.assign(Object.create(Object.getPrototypeOf(restOperation)), restOperation);
        postOp.complete = () => postOp;
        postOp.setMethod('Post');

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid,
                'Fetching application data from AS3',
                this.driver.getApplication(tenant, app)
            ))
            .then((appData) => {
                Object.assign(appData.view, newParameters);
                return appData;
            })
            .then(appData => Promise.all([
                appData,
                this.renderTemplates(reqid, [{
                    name: appData.template,
                    parameters: appData.view
                }])
            ]))
            .then(([appData, rendered]) => Promise.all([
                appData,
                this.driver.getTenantAndAppFromDecl(rendered[0].appDef)
            ]))
            .then(([appData, tenantAndApp]) => {
                const [tenantName, appName] = tenantAndApp;
                if (tenantName !== tenant) {
                    return Promise.reject(
                        this.genRestResponse(
                            restOperation,
                            422,
                            `Client Error: PATCH would change tenant name from ${tenant} to ${tenantName}`,
                            undefined
                        )
                    );
                }
                if (appName !== app) {
                    return Promise.reject(
                        this.genRestResponse(
                            restOperation,
                            422,
                            `Client Error: PATCH would change application name from ${app} to ${appName}`,
                            undefined
                        )
                    );
                }

                return appData;
            })
            .then((appData) => {
                postOp.setBody({
                    name: appData.template,
                    parameters: appData.view
                });
                return this.onPost(postOp);
            })
            .then(() => {
                let respBody = postOp.getBody();
                respBody = respBody.message || respBody;
                this.genRestResponse(restOperation, postOp.getStatusCode(), respBody, undefined);
            })
            .catch((e) => {
                if (restOperation.getStatusCode() < 400) {
                    this.genRestResponse(restOperation, 500, e.message, e.stack);
                }
            });
    }

    /**
     * modify FAST config Settings
     * @param {Object} restOperation
     * @param {Object} config - new FASTWorker config Settings
     * @returns {Promise}
     */
    patchSettings(restOperation, config) {
        const reqid = restOperation.requestId;
        let combinedConfig = {};

        return Promise.resolve()
            .then(() => this.getConfig(reqid))
            .then(prevConfig => this.encryptConfigSecrets(config)
                .then(() => prevConfig))
            .then((prevConfig) => {
                combinedConfig = Object.assign({}, prevConfig, config);
            })
            .then(() => this.validateConfig(combinedConfig))
            .catch(e => Promise.reject(this.genRestResponse(
                restOperation,
                422,
                `Client Error: Supplied settings were not valid:\n${e.message}`,
                e.stack
            )))
            .then(() => this.saveConfig(combinedConfig, reqid))
            .then(() => Promise.resolve(this.tracer.setOptions(
                this.deviceInfo,
                this.as3Info,
                combinedConfig.perfTracing
            )))
            .then(() => this.genRestResponse(restOperation, 200, '', undefined))
            .catch((e) => {
                if (restOperation.getStatusCode() < 400) {
                    this.genRestResponse(restOperation, 500, e.message, e.stack);
                }
            });
    }

    /**
     * PATCH Request handler
     * @param {Object} restOperation
     * @returns {Promise}
     */
    onPatch(restOperation) {
        const body = restOperation.getBody();
        const pathElements = _getPathElements(restOperation);
        const collection = pathElements.collection;
        const itemid = pathElements.itemId;

        restOperation.requestId = this.generateRequestId();

        this.recordRestRequest(restOperation);

        return Promise.resolve()
            .then(() => this.handleLazyInit(restOperation.requestId))
            .then(() => this.validateRequest(restOperation))
            .then(() => {
                try {
                    switch (collection) {
                    case 'applications':
                        return this.patchApplications(restOperation, itemid, body);
                    case 'settings':
                        return this.patchSettings(restOperation, body);
                    default:
                        return this.genRestResponse(restOperation, 404, `Client Error: unknown endpoint ${pathElements.pathname}`, undefined);
                    }
                } catch (e) {
                    return this.genRestResponse(restOperation, 500, e.message, e.stack);
                }
            })
            .catch(e => this.genRestResponse(restOperation, 400, e.message, e.stack));
    }

    /**
     * validate Request
     * @param {Object} restOperation
     * @returns {Promise}
     */
    validateRequest(restOperation) {
        const requestContentType = restOperation.getContentType();
        if (['Post', 'Patch'].includes(restOperation.getMethod()) && requestContentType !== 'application/json') {
            return Promise.reject(new Error(`Content-Type application/json is required, got ${requestContentType}`));
        }
        return Promise.resolve();
    }
}

module.exports = FASTWorker;
