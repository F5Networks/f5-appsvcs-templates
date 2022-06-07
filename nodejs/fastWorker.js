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
const url = require('url');

const extract = require('extract-zip');
const Ajv = require('ajv');
const merge = require('deepmerge');
const Mustache = require('mustache');
const semver = require('semver');

const fast = require('@f5devcentral/f5-fast-core');
const atgStorage = require('@f5devcentral/atg-storage');
const TeemDevice = require('@f5devcentral/f5-teem').Device;
const { Tracer, TraceTags, TraceUtil } = require('@f5devcentral/atg-shared-utilities').tracer;

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

class FASTWorker {
    constructor(options) {
        options = options || {};
        if (typeof options.uploadPath === 'undefined') {
            options.uploadPath = '/var/config/rest/downloads';
        }
        this.as3Info = null;
        this.requestCounter = 1;
        this.setTracer();
        this.hookOnShutDown();
        const ctx = this.generateContext({
            isRestOp: false,
            message: 'creating_fast_worker',
            requestId: this.requestCounter
        });
        this.state = {};

        this.version = options.version || pkg.version;
        this.baseUserAgent = `${pkg.name}/${this.version}`;
        this.incomingUserAgent = '';

        this.configPath = options.configPath || `/var/config/rest/iapps/${projectName}`;
        this.templatesPath = options.templatesPath || `${this.configPath}/templatesets`;
        this.uploadPath = options.uploadPath;
        this.scratchPath = `${this.configPath}/scratch`;

        this._lazyInitComplete = false;
        this.lazyInit = options.lazyInit;

        this.initRetries = 0;
        this.initMaxRetries = 2;
        this.initTimeout = false;

        this.isPublic = true;
        this.isPassThrough = true;
        this.WORKER_URI_PATH = `shared/${endpointName}`;
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
            ctx
        });
        this.storage = options.templateStorage || new StorageDataGroup(dataGroupPath);
        this.configStorage = options.configStorage || new StorageDataGroup(configDGPath);
        this.templateProvider = new DataStoreTemplateProvider(this.storage, undefined, supportedHashes);
        this.fsTemplateProvider = new FsTemplateProvider(this.templatesPath, options.fsTemplateList);
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
                this.logger.info(`FAST Worker [${id}]: Entering ${text}`);
            },
            (transaction, _exitTime, deltaTime) => {
                const [id, text] = transaction.split('@@');
                this.logger.info(`FAST Worker [${id}]: Exiting ${text}`);
                this.logger.fine(`FAST Worker [${id}]: ${text} took ${deltaTime}ms to complete`);
            }
        );
        this.ipamProviders = options.ipamProviders;
        this.minAs3Version = options.minAs3Version || '3.16';

        this.requestTimes = {};
        this.provisionData = null;
        this._hydrateCache = null;
        this._provisionConfigCacheTime = null;
        ctx.span.log('created_fast_worker');
        ctx.span.finish();
    }

    hookCompleteRestOp() {
        // Hook completeRestOperation() so we can add additional logging
        this._prevCompleteRestOp = this.completeRestOperation;
        this.completeRestOperation = (restOperation, ctx) => {
            if (!Array.isArray(restOperation.body) && restOperation.body) {
                restOperation.body._links = {
                    self: restOperation.uri.path ? `/mgmt${restOperation.uri.path}` : `/mgmt/${restOperation.uri}`
                };
                if (restOperation.uri.path && restOperation.uri.path.includes('/shared/fast/applications') && ['Post', 'Patch', 'Delete'].includes(restOperation.method) && restOperation.statusCode === 202) {
                    restOperation.body._links.task = restOperation.body.message.map(x => `/mgmt/shared/fast/tasks/${x.id}`).pop();
                }
            } else if (Array.isArray(restOperation.body)) {
                restOperation.body = restOperation.body.map((x) => {
                    if (typeof x === 'object') {
                        let selfLink = '';
                        if (restOperation.uri.path && restOperation.uri.path.includes('/shared/fast/applications')) {
                            selfLink = restOperation.uri.path ? `/mgmt${restOperation.uri.path.replace(/\/$/, '')}/${x.tenant}/${x.name}` : `/mgmt/${restOperation.uri}`;
                        } else if (restOperation.uri.path && restOperation.uri.path.includes('/shared/fast/tasks')) {
                            selfLink = restOperation.uri.path ? `/mgmt${restOperation.uri.path.replace(/\/$/, '')}/${x.id}` : `/mgmt/${restOperation.uri}`;
                        } else {
                            selfLink = restOperation.uri.path ? `/mgmt${restOperation.uri.path.replace(/\/$/, '')}/${x.name}` : `/mgmt/${restOperation.uri}`;
                        }
                        x._links = {
                            self: selfLink
                        };
                    }
                    return x;
                });
            }
            this.recordRestResponse(restOperation, ctx);
            return this._prevCompleteRestOp(restOperation);
        };
    }

    hookOnShutDown() {
        this._prevShutDown = this.onShutDown;
        this.onShutDown = () => {
            this.tracer.close();
            this._prevShutDown();
        };
    }

    validateConfig(config) {
        return Promise.resolve()
            .then(() => ajv.compile(this.getConfigSchema()))
            .then((validate) => {
                const valid = validate(config);
                if (!valid) {
                    return Promise.reject(new Error(
                        `invalid config: ${validate.errors}`
                    ));
                }

                return Promise.resolve(config);
            });
    }

    _getDefaultConfig() {
        const defaultConfig = {
            deletedTemplateSets: [],
            perfTracing: {
                enabled: String(process.env.F5_PERF_TRACING_ENABLED).toLowerCase() === 'true',
                debug: String(process.env.F5_PERF_TRACING_DEBUG).toLowerCase() === 'true'
            },
            enableIpam: false,
            ipamProviders: [],
            disableDeclarationCache: false
        };
        return Object.assign({}, defaultConfig, this.driver.getDefaultSettings());
    }

    getConfig(reqid, ctx) {
        reqid = reqid || 0;
        let mergedDefaults = this._getDefaultConfig();
        return Promise.resolve()
            .then(() => this.enterTransaction(reqid, 'gathering config data'))
            .then(() => this.gatherProvisionData(reqid, true, false, ctx))
            .then(provisionData => Promise.all([
                this.configStorage.getItem(configKey),
                this.driver.getSettings(provisionData[0])
            ]))
            .then(([config, driverSettings]) => {
                if (config) {
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

    saveConfig(config, reqid, ctx) {
        reqid = reqid || 0;
        let prevConfig;
        let persisted = false;
        return Promise.resolve()
            .then(() => this.enterTransaction(reqid, 'saving config data'))
            .then(() => this.configStorage.getItem(configKey, config))
            .then((data) => {
                prevConfig = data;
            })
            .then(() => this.gatherProvisionData(reqid, true, false, ctx))
            .then(provisionData => this.driver.setSettings(config, provisionData))
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
            .then(() => this.exitTransaction(reqid, 'saving config data'))
            .then(() => persisted)
            .catch((e) => {
                this.logger.severe(`FAST Worker: Failed to save config: ${e.stack}`);
            });
    }

    encryptConfigSecrets(newConfig, prevConfig) {
        return Promise.all((newConfig.ipamProviders || []).map(provider => Promise.resolve()
            .then(() => {
                const prevProvider = prevConfig.ipamProviders.filter(
                    x => x.name === provider.name
                )[0];

                if (prevProvider && prevProvider.password === provider.password) {
                    return Promise.resolve(provider.password);
                }

                return this.secretsManager.encrypt(provider.password || '');
            })
            .then((password) => {
                provider.password = password;
            })));
    }

    handleResponseError(e, description) {
        description = description || 'request';
        if (e.response) {
            const errData = JSON.stringify({
                status: e.response.status,
                body: e.response.data
            }, null, 2);
            return Promise.reject(new Error(`failed ${description}: ${errData}`));
        }
        return Promise.reject(e);
    }

    /**
     * Worker Handlers
     */
    onStart(success, error) {
        this.hookCompleteRestOp();
        // instantiate here to ensure logger instance is ready
        this.ipamProviders = new IpamProviders({
            secretsManager: this.secretsManager,
            transactionLogger: this.transactionLogger,
            logger: this.logger
        });
        this.setTracer();
        this.hookOnShutDown();

        this.logger.info('FAST Worker: Entering STARTED state');
        this.logger.fine(`FAST Worker: Starting ${pkg.name} v${this.version}`);
        this.logger.fine(`FAST Worker: Targetting ${this.bigip.host}`);
        const startTime = Date.now();

        const ctx = this.generateContext({
            isRestOp: false,
            message: 'app_start',
            requestId: this.requestCounter
        });

        return Promise.resolve()
            // Automatically add a block
            .then(() => {
                const hosturl = this.bigip.host ? url.parse(this.bigip.host) : '';
                if (hosturl.hostname !== 'localhost') {
                    return Promise.resolve();
                }

                return Promise.resolve()
                    .then(() => this.enterTransaction(0, 'ensure FAST is in iApps blocks'))
                    .then(() => this.bigip.getIAppsBlocks(ctx))
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
                            return this.bigip.addIAppsBlock(blockData, ctx);
                        }

                        // Found a block, do nothing
                        return Promise.resolve({ status: 200 });
                    })
                    .catch(e => this.handleResponseError(e, 'to set block state'))
                    .then(() => this.exitTransaction(0, 'ensure FAST is in iApps blocks'));
            })
            .then(() => {
                if (this.lazyInit) {
                    ctx.span.log({ event: 'lazy_init_enabled' });
                    return Promise.resolve(this._getDefaultConfig());
                }
                return this.initWorker(0, ctx);
            })
            // Done
            .then((config) => {
                const dt = Date.now() - startTime;
                this.logger.info('FAST Worker: Entering READY state');
                this.logger.fine(`FAST Worker: Startup completed in ${dt}ms`);
                ctx.span.log({ event: 'worked_initialized' });
                ctx.span.finish();
                this.setTracer(config.perfTracing);
            })
            .then(() => success())
            // Errors
            .catch((e) => {
                this.logger.info(`FAST Worker: Entering UNHEALTHY state: ${e.message}`);
                if ((e.status && e.status === 404) || e.message.match(/ 404/)) {
                    this.logger.info('FAST Worker: onStart 404 error in initWorker; retry initWorker but start Express');
                    return success();
                }
                this.logger.severe(`FAST Worker: Failed to start: ${e.stack}`);
                ctx.span.logError(e);
                return error();
            });
    }

    onStartCompleted(success, error, _loadedState, errMsg) {
        if (typeof errMsg === 'string' && errMsg !== '') {
            this.logger.error(`FAST Worker onStart error: ${errMsg}`);
            return error();
        }
        return success();
    }

    initWorker(reqid, ctx) {
        reqid = reqid || 0;
        let config;
        this._lazyInitComplete = true;

        return Promise.resolve()
            // Load config
            .then(() => this.getConfig(reqid, ctx))
            .then((cfg) => {
                ctx.span.log({ event: 'config_loaded' });
                config = cfg;
            })
            .then(() => this.setDeviceInfo(reqid, ctx))
            // Get the AS3 driver ready
            .then(() => this.prepareAS3Driver(reqid, config, ctx))
            // Load template sets from disk (i.e., those from the RPM)
            .then(() => this.loadOnDiskTemplateSets(reqid, config))
            // watch for configSync logs, if device is in an HA Pair
            .then(() => this.bigip.watchConfigSyncStatus(this.onConfigSync.bind(this), ctx))
            .then(() => {
                this.generateTeemReportOnStart(reqid, ctx);
            })
            .then(() => Promise.resolve(config))
            .catch((e) => {
                if (this.initTimeout) {
                    clearTimeout(this.initTimeout);
                }
                this.logger.info(`FAST Worker: Entering UNHEALTHY state: ${e.message}`);
                // we will retry initWorker 3 times for 404 errors
                if (this.initRetries <= this.initMaxRetries && ((e.status && e.status === 404) || e.message.match(/ 404/))) {
                    this.initRetries += 1;
                    this.initTimeout = setTimeout(() => { this.initWorker(reqid, ctx); }, 2000);
                    this.logger.info(`FAST Worker: initWorker failed; Retry #${this.initRetries}. Error: ${e.message}`);
                    return Promise.resolve();
                }
                this.logger.severe(`FAST Worker: initWorker failed. ${e.message}`);
                return Promise.reject(e);
            });
    }

    handleLazyInit(reqid, ctx) {
        if (!this.lazyInit || this._lazyInitComplete) {
            return Promise.resolve();
        }

        return this.recordTransaction(
            reqid,
            'run lazy initialization',
            this.initWorker(reqid, ctx)
        );
    }

    prepareAS3Driver(reqid, config, ctx) {
        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid,
                'ready AS3 driver',
                this.driver.loadMixins()
            ))
            .then(() => this.recordTransaction(
                reqid,
                'sync AS3 driver settings',
                Promise.resolve()
                    .then(() => this.saveConfig(config, reqid, ctx))
            ));
    }

    loadOnDiskTemplateSets(reqid, config) {
        let saveState = true;

        return Promise.resolve()
            .then(() => this.enterTransaction(reqid, 'loading template sets from disk'))
            .then(() => this.recordTransaction(
                reqid,
                'gather list of templates from disk',
                this.fsTemplateProvider.listSets()
            ))
            .then((fsSets) => {
                const deletedSets = config.deletedTemplateSets;
                const ignoredSets = [];
                const sets = [];
                fsSets.forEach((setName) => {
                    if (deletedSets.includes(setName)) {
                        ignoredSets.push(setName);
                    } else {
                        sets.push(setName);
                    }
                });
                this.logger.info(
                    `FAST Worker: Loading template sets from disk: ${JSON.stringify(sets)} (skipping: ${JSON.stringify(ignoredSets)})`
                );
                if (sets.length === 0) {
                    // Nothing to do
                    saveState = false;
                    return Promise.resolve();
                }
                this.templateProvider.invalidateCache();
                return DataStoreTemplateProvider.fromFs(this.storage, this.templatesPath, sets);
            })
            .then(() => this.exitTransaction(reqid, 'loading template sets from disk'))
            // Persist any template set changes
            .then(() => saveState && this.recordTransaction(reqid, 'persist template data store', this.storage.persist()));
    }

    onConfigSync() {
        return Promise.resolve()
            .then(() => this.storage.clearCache())
            .then(() => this.configStorage.clearCache())
            .then(() => this.driver.invalidateCache())
            .then(() => this.templateProvider.invalidateCache());
    }

    setDeviceInfo(reqid, ctx) {
        // If device-info is unavailable intermittently, this can be placed in onStart
        // and call setDeviceInfo in onStartCompleted
        // this.dependencies.push(this.restHelper.makeRestjavadUri(
        //     '/shared/identified-devices/config/device-info'
        // ));
        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid,
                'fetching device information',
                this.bigip.getDeviceInfo(ctx)
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
    sendTeemReport(reportName, reportVersion, data) {
        if (!this.teemDevice) {
            return Promise.resolve();
        }

        const documentName = `${projectName}: ${reportName}`;
        const baseData = {
            userAgent: this.incomingUserAgent
        };
        Promise.resolve()
            .then(() => {
                this.teemDevice.report(documentName, `${reportVersion}`, baseData, data)
                    .catch(e => this.logger.error(`FAST Worker failed to send telemetry data: ${e.stack}`));
            });

        return Promise.resolve();
    }

    setTracer(options) {
        if (this.tracer) {
            this.tracer.close();
        }
        let tracerOpts;
        // tracer will be init from env variables if no opts supplied
        // (minimal to record app start)
        const defaultOpts = {
            logger: this.logger,
            tags: {
                [TraceTags.APP.VERSION]: pkg.version,
                'as3.version': this.as3Info ? this.as3Info.version : ''
            }
        };
        if (this.deviceInfo) {
            Object.assign(defaultOpts.tags, TraceUtil.buildDeviceTags(this.deviceInfo));
        }
        if (!options) {
            tracerOpts = defaultOpts;
        } else {
            tracerOpts = Object.assign({}, defaultOpts, options);
        }
        this.tracer = new Tracer(pkg.name, tracerOpts);
    }

    generateTeemReportOnStart(reqid, ctx) {
        if (!this.teemDevice) {
            return Promise.resolve();
        }

        return this.gatherInfo(reqid, ctx)
            .then(info => this.sendTeemReport('onStart', 1, info))
            .catch(e => this.logger.error(`FAST Worker failed to send telemetry data: ${e.stack}`));
    }

    generateTeemReportApplication(action, templateName) {
        if (!this.teemDevice) {
            return Promise.resolve();
        }

        const report = {
            action,
            templateName
        };
        return Promise.resolve()
            .then(() => this.sendTeemReport('Application Management', 1, report))
            .catch(e => this.logger.error(`FAST Worker failed to send telemetry data: ${e.stack}`));
    }

    generateTeemReportTemplateSet(action, templateSetName) {
        if (!this.teemDevice) {
            return Promise.resolve();
        }

        const report = {
            action,
            templateSetName
        };
        return Promise.resolve()
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
    }

    generateTeemReportError(restOp) {
        if (!this.teemDevice) {
            return Promise.resolve();
        }

        const uri = restOp.getUri();
        const pathElements = uri.pathname.split('/');
        let endpoint = pathElements.slice(0, 4).join('/');
        if (pathElements[4]) {
            endpoint = `${endpoint}/item`;
        }
        const report = {
            method: restOp.getMethod(),
            endpoint,
            code: restOp.getStatusCode()
        };
        return Promise.resolve()
            .then(() => this.sendTeemReport('Error', 1, report))
            .catch(e => this.logger.error(`FAST Worker failed to send telemetry data: ${e.stack}`));
    }

    /**
     * Helper functions
     */
    generateRequestId() {
        const retval = this.requestCounter;
        this.requestCounter += 1;
        return retval;
    }

    generateContext(operation) {
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
        // Processing restOp object
        const pathName = operation.getUri().pathname;
        const pathElements = pathName.split('/');
        const context = {
            body: operation.getBody(),
            collectionPath: pathElements.slice(0, 4).join('/'),
            collection: pathElements[3],
            itemId: pathElements[4],
            pathName,
            requestId: operation.requestId,
            tracer: this.tracer
        };

        const getSpanPath = function (ctx) {
            switch (ctx.collection) {
            case 'info':
            case 'settings':
            case 'settings-schema':
                return ctx.collectionPath;
            case 'templates':
                return `${ctx.collectionPath}${ctx.itemId ? '/setName/{templateName}' : ''}`;
            case 'applications':
                return `${ctx.collectionPath}${ctx.itemId ? '/tenantName/{appName}' : ''}`;
            case 'tasks':
                return `${ctx.collectionPath}${ctx.itemId ? '/{taskId}' : ''}`;
            case 'templatesets':
                return `${ctx.collectionPath}${ctx.itemId ? '/{setName}' : ''}`;
            default:
                return pathName.substring(pathName.indexOf('/', 1));
            }
        };

        context.span = this.tracer.startHttpSpan(getSpanPath(context), pathName, operation.getMethod());

        return context;
    }

    enterTransaction(reqid, text) {
        this.transactionLogger.enter(`${reqid}@@${text}`);
    }

    exitTransaction(reqid, text) {
        this.transactionLogger.exit(`${reqid}@@${text}`);
    }

    recordTransaction(reqid, text, promise) {
        return this.transactionLogger.enterPromise(`${reqid}@@${text}`, promise);
    }

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

    gatherTemplateSet(tsid, ctx) {
        return Promise.all([
            this.templateProvider.hasSet(tsid)
                .then(result => (result ? this.templateProvider.getSetData(tsid) : Promise.resolve(undefined)))
                .then((tsData) => {
                    if (tsData) {
                        return Promise.resolve(tsData);
                    }

                    return Promise.resolve()
                        .then(() => this.fsTemplateProvider.hasSet(tsid))
                        .then(result => (result ? this.fsTemplateProvider.getSetData(tsid) : undefined))
                        .then((fsTsData) => {
                            if (fsTsData) {
                                fsTsData.enabled = false;
                            }
                            return fsTsData;
                        });
                }),
            this.driver.listApplications(ctx)
        ])
            .then(([tsData, appsList]) => {
                if (!tsData) {
                    return Promise.reject(new Error(`Template set ${tsid} does not exist`));
                }

                if (typeof tsData.enabled === 'undefined') {
                    tsData.enabled = true;
                }
                tsData.templates.forEach((tmpl) => {
                    tmpl.appsList = appsList
                        .filter(x => x.template === tmpl.name)
                        .map(x => `${x.tenant}/${x.name}`);
                });

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

    gatherInfo(requestId, ctx) {
        requestId = requestId || 0;
        const info = {
            version: this.version,
            as3Info: {},
            installedTemplates: []
        };

        return Promise.resolve()
            .then(() => this.recordTransaction(
                requestId,
                'GET to appsvcs/info',
                this.driver.getInfo()
            ))
            .then((as3response) => {
                info.as3Info = as3response.data;
                this.as3Info = info.as3Info;
            })
            .then(() => this.enterTransaction(requestId, 'gathering template set data'))
            .then(() => this.templateProvider.listSets())
            .then(setList => Promise.all(setList.map(setName => this.gatherTemplateSet(setName, ctx))))
            .then((tmplSets) => {
                info.installedTemplates = tmplSets;
            })
            .then(() => this.exitTransaction(requestId, 'gathering template set data'))
            .then(() => this.getConfig(requestId, ctx))
            .then((config) => {
                info.config = config;
                ctx.span.finish();
            })
            .then(() => info);
    }

    gatherProvisionData(requestId, clearCache, skipAS3, ctx) {
        if (clearCache && (Date.now() - this._provisionConfigCacheTime) >= 10000) {
            this.provisionData = null;
            this._provisionConfigCacheTime = Date.now();
        }
        return Promise.resolve()
            .then(() => {
                if (this.provisionData !== null) {
                    return Promise.resolve(this.provisionData);
                }

                return this.recordTransaction(
                    requestId,
                    'Fetching module provision information',
                    this.bigip.getProvisionData(ctx)
                );
            })
            .then((response) => {
                this.provisionData = response;
            })
            .then(() => {
                const tsInfo = this.provisionData.items.filter(x => x.name === 'ts')[0];
                if (tsInfo) {
                    return Promise.resolve({ status: 304 });
                }

                return this.recordTransaction(
                    requestId,
                    'Fetching TS module information',
                    this.bigip.getTSInfo(ctx)
                );
            })
            .then((response) => {
                if (response.status === 304) {
                    return Promise.resolve();
                }

                return this.provisionData.items.push({
                    name: 'ts',
                    level: (response.status === 200) ? 'nominal' : 'none'
                });
            })
            .then(() => {
                if (skipAS3 || (this.as3Info !== null && this.as3Info.version)) {
                    return Promise.resolve(this.as3Info);
                }
                return this.recordTransaction(
                    requestId,
                    'Fetching AS3 info',
                    this.driver.getInfo()
                )
                    .then(response => response.data);
            })
            .then((response) => {
                this.as3Info = response;
            })
            .then(() => Promise.all([
                Promise.resolve(this.provisionData),
                Promise.resolve(this.as3Info),
                Promise.resolve(this.deviceInfo)
            ]));
    }

    checkDependencies(tmpl, requestId, clearCache, ctx) {
        return Promise.resolve()
            .then(() => this.gatherProvisionData(requestId, clearCache, false, ctx))
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
                        .then(() => this.checkDependencies(subtmpl, requestId, false, ctx));
                });
                const validOneOf = [];
                let errstr = '';
                tmpl._oneOf.forEach((subtmpl) => {
                    promiseChain = promiseChain
                        .then(() => this.checkDependencies(subtmpl, requestId, false, ctx))
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
                        .then(() => this.checkDependencies(subtmpl, requestId, false, ctx))
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

    hydrateSchema(tmpl, requestId, clearCache, ctx) {
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

                return this.getConfig(requestId, ctx)
                    .then((config) => {
                        this._hydrateCache.__config = config;
                    });
            })
            .then(() => Promise.all(subTemplates.map(x => this.hydrateSchema(x, requestId, false, ctx))))
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
                                this.bigip.getSharedObjects(endPoint, prop.enumFromBigip.filter, ctx)
                            )
                                .then((items) => {
                                    this._hydrateCache[endPoint] = items;
                                    return items;
                                });
                        })
                        .catch(e => this.handleResponseError(e, `GET to ${endPoint}`))
                        .catch(e => Promise.reject(new Error(`Failed to hydrate ${endPoint}\n${e.stack}`))))))
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

    removeIpamProps(tmpl, requestId, ctx) {
        const subTemplates = [
            ...tmpl._allOf || [],
            ...tmpl._oneOf || [],
            ...tmpl._anyOf || []
        ];

        if (!this._hydrateCache) {
            this._hydrateCache = {};
        }

        return Promise.resolve()
            .then(() => Promise.all(subTemplates.map(x => this.removeIpamProps(x, requestId, ctx))))
            .then(() => {
                if (this._hydrateCache.__config) {
                    return Promise.resolve(this._hydrateCache.__config);
                }

                return this.getConfig(requestId, ctx)
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

    convertPoolMembers(restOperation, apps) {
        const reqid = restOperation.requestId;

        const convertTemplateNames = [
            'bigip-fast-templates/http',
            'bigip-fast-templates/tcp',
            'bigip-fast-templates/microsoft_iis'
        ];

        const newApps = [];

        apps.forEach((app) => {
            const convert = (
                convertTemplateNames.includes(app.template)
                && app.view.pool_members
                && app.view.pool_members.length > 0
                && typeof app.view.pool_members[0] === 'string'
            );
            if (convert) {
                app.view.pool_members = [{
                    serverAddresses: app.view.pool_members,
                    servicePort: app.view.pool_port || 80
                }];
                delete app.view.pool_port;
                newApps.push(app);
                this.logger.info(
                    `FAST Worker [${reqid}]: updating pool_members on ${app.tenant}/${app.name}`
                );
            }
        });

        let promiseChain = Promise.resolve();
        // clone restOp, but make sure to unhook complete op
        const postOp = Object.assign(Object.create(Object.getPrototypeOf(restOperation)), restOperation);
        postOp.complete = () => postOp;
        postOp.setMethod('Post');

        if (newApps.length > 0) {
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

    releaseIPAMAddressesFromApps(reqid, appsData, ctx) {
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
                    return this.getConfig(reqid, ctx)
                        .then((c) => { config = c; });
                })
                .then(() => this.ipamProviders.releaseIPAMAddress(reqid, config, view));
        });

        return promiseChain;
    }

    fetchTemplate(reqid, tmplid, ctx) {
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
                    .then(() => this.checkDependencies(tmpl, reqid, true, ctx))
                    .then(() => this.hydrateSchema(tmpl, reqid, true, ctx))
                    .then(() => {
                        // Remove IPAM features in official templates if not enabled
                        if (tmplid.split('/')[0] !== 'bigip-fast-templates') {
                            return Promise.resolve();
                        }

                        return this.removeIpamProps(tmpl, reqid, ctx);
                    })
                    .then(() => tmpl);
            });
    }

    renderTemplates(reqid, data, ctx) {
        const appsData = [];
        const lastModified = new Date().toISOString();
        let config = {};
        let appsList = [];
        let promiseChain = Promise.resolve()
            .then(() => this.getConfig(reqid, ctx))
            .then((configData) => {
                config = configData;
            })
            .then(() => this.driver.listApplicationNames(ctx))
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
                .then(() => this.fetchTemplate(reqid, tmplData.name, ctx))
                .catch(e => Promise.reject(new Error(`unable to load template: ${tmplData.name}\n${e.stack}`)))
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
                    .then(() => Promise.reject(new Error(`failed to render template: ${tmplData.name}\n${e.stack}`))))
                .then((decl) => {
                    const appData = {
                        appDef: decl,
                        metaData: {
                            template: tmplData.name,
                            setHash: tsData.hash,
                            view: tmplData.parameters,
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
    }

    recordRestResponse(restOp, ctx) {
        const minOp = {
            method: restOp.getMethod(),
            path: restOp.getUri().pathname,
            status: restOp.getStatusCode()
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
        if (!ctx.span.finished) {
            ctx.span.tagHttpCode(minOp.status);
            ctx.span.finish();
        }
    }

    genRestResponse(restOperation, code, message, ctx) {
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
        this.completeRestOperation(restOperation, ctx);
        if (code >= 400) {
            this.generateTeemReportError(restOperation);
            ctx.span.logError(message);
        }
        return Promise.resolve();
    }

    getInfo(restOperation, ctx) {
        return Promise.resolve()
            .then(() => this.gatherInfo(restOperation.requestId, ctx))
            .then((info) => {
                restOperation.setBody(info);
                this.completeRestOperation(restOperation, ctx);
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.stack, ctx));
    }

    getTemplates(restOperation, tmplid, ctx) {
        const reqid = restOperation.requestId;
        if (tmplid) {
            const uri = restOperation.getUri();
            const pathElements = uri.pathname.split('/');
            tmplid = pathElements.slice(4, 6).join('/');

            return Promise.resolve()
                .then(() => this.fetchTemplate(reqid, tmplid, ctx))
                .then((tmpl) => {
                    restOperation.setBody(tmpl);
                    this.completeRestOperation(restOperation, ctx);
                })
                .catch((e) => {
                    if (e.message.match(/Could not find template/)) {
                        return this.genRestResponse(restOperation, 404, e.stack, ctx);
                    }
                    return this.genRestResponse(restOperation, 400, `Error: Failed to load template ${tmplid}\n${e.stack}`, ctx);
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
                this.completeRestOperation(restOperation, ctx);
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.stack, ctx));
    }

    getApplications(restOperation, appid, ctx) {
        const reqid = restOperation.requestId;
        if (appid) {
            const uri = restOperation.getUri();
            const pathElements = uri.pathname.split('/');
            const tenant = pathElements[4];
            const app = pathElements[5];
            return Promise.resolve()
                .then(() => this.recordTransaction(
                    reqid,
                    'GET request to appsvcs/declare',
                    this.driver.getRawDeclaration()
                ))
                .then(resp => resp.data[tenant][app])
                .then(appDef => this.convertPoolMembers(restOperation, [appDef]))
                .then((appDefs) => {
                    restOperation.setBody(appDefs[0]);
                    this.completeRestOperation(restOperation, ctx);
                })
                .catch(e => this.genRestResponse(restOperation, 404, e.stack, ctx));
        }

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid,
                'gathering a list of applications from the driver',
                this.driver.listApplications(ctx)
            ))
            .then(appsList => this.convertPoolMembers(restOperation, appsList))
            .then((appsList) => {
                restOperation.setBody(appsList);
                this.completeRestOperation(restOperation, ctx);
            });
    }

    getTasks(restOperation, taskid, ctx) {
        const reqid = restOperation.requestId;
        if (taskid) {
            return Promise.resolve()
                .then(() => this.recordTransaction(
                    reqid,
                    'gathering a list of tasks from the driver',
                    this.driver.getTasks(ctx)
                ))
                .then(taskList => taskList.filter(x => x.id === taskid))
                .then((taskList) => {
                    if (taskList.length === 0) {
                        return this.genRestResponse(restOperation, 404, `unknown task ID: ${taskid}`, ctx);
                    }
                    restOperation.setBody(taskList[0]);
                    this.completeRestOperation(restOperation, ctx);
                    return Promise.resolve();
                })
                .catch(e => this.genRestResponse(restOperation, 500, e.stack, ctx));
        }

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid,
                'gathering a list of tasks from the driver',
                this.driver.getTasks(ctx)
            ))
            .then((tasksList) => {
                restOperation.setBody(tasksList);
                this.completeRestOperation(restOperation, ctx);
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.stack, ctx));
    }

    getTemplateSets(restOperation, tsid, ctx) {
        const queryParams = restOperation.getUri().query;
        const showDisabled = queryParams.showDisabled || false;
        const reqid = restOperation.requestId;
        if (tsid) {
            return Promise.resolve()
                .then(() => this.recordTransaction(
                    reqid,
                    'gathering a template set',
                    this.gatherTemplateSet(tsid, ctx)
                ))
                .then((tmplSet) => {
                    restOperation.setBody(tmplSet);
                    if (tmplSet.error) {
                        return Promise.reject(new Error(tmplSet.error));
                    }
                    this.completeRestOperation(restOperation, ctx);
                    return Promise.resolve();
                })
                .catch((e) => {
                    if (e.message.match(/No templates found/) || e.message.match(/does not exist/)) {
                        return this.genRestResponse(restOperation, 404, e.message, ctx);
                    }
                    return this.genRestResponse(restOperation, 500, e.stack, ctx);
                });
        }

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid,
                'gathering a list of template sets',
                (showDisabled) ? this.fsTemplateProvider.listSets() : this.templateProvider.listSets()
            ))
            .then(setList => this.recordTransaction(
                reqid,
                'gathering data for each template set',
                Promise.all(setList.map(x => this.gatherTemplateSet(x, ctx)))
            ))
            .then(setList => ((showDisabled) ? setList.filter(x => !x.enabled) : setList))
            .then((setList) => {
                restOperation.setBody(setList);
                this.completeRestOperation(restOperation, ctx);
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.stack, ctx));
    }

    getSettings(restOperation, ctx) {
        const reqid = restOperation.requestId;
        return Promise.resolve()
            .then(() => this.getConfig(reqid, ctx))
            .then((config) => {
                restOperation.setBody(config);
                this.completeRestOperation(restOperation, ctx);
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.stack, ctx));
    }

    getSettingsSchema(restOperation, ctx) {
        return Promise.resolve()
            .then(() => {
                const schema = this.getConfigSchema();
                restOperation.setBody(schema);
                this.completeRestOperation(restOperation, ctx);
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.stack, ctx));
    }

    onGet(restOperation) {
        const uri = restOperation.getUri();
        const pathElements = uri.pathname.split('/');
        const collection = pathElements[3];
        const itemid = pathElements[4];
        restOperation.requestId = this.generateRequestId();
        const ctx = this.generateContext(restOperation);
        this.recordRestRequest(restOperation);

        return Promise.resolve()
            .then(() => this.handleLazyInit(restOperation.requestId, ctx))
            .then(() => this.validateRequest(restOperation))
            .then(() => {
                try {
                    switch (collection) {
                    case 'info':
                        return this.getInfo(restOperation, ctx);
                    case 'templates':
                        return this.getTemplates(restOperation, itemid, ctx);
                    case 'applications':
                        return this.getApplications(restOperation, itemid, ctx);
                    case 'tasks':
                        return this.getTasks(restOperation, itemid, ctx);
                    case 'templatesets':
                        return this.getTemplateSets(restOperation, itemid, ctx);
                    case 'settings':
                        return this.getSettings(restOperation, ctx);
                    case 'settings-schema':
                        return this.getSettingsSchema(restOperation, ctx);
                    default:
                        return this.genRestResponse(restOperation, 404, `unknown endpoint ${uri.pathname}`, ctx);
                    }
                } catch (e) {
                    return this.genRestResponse(restOperation, 500, e.stack, ctx);
                }
            })
            .catch(e => this.genRestResponse(restOperation, 400, e.message, ctx));
    }

    postApplications(restOperation, data, ctx) {
        const reqid = restOperation.requestId;
        if (!Array.isArray(data)) {
            data = [data];
        }

        // this.logger.info(`postApplications() received:\n${JSON.stringify(data, null, 2)}`);
        let appsData;

        return Promise.resolve()
            .then(() => this.renderTemplates(reqid, data, ctx))
            .catch((e) => {
                let code = 400;
                if (e.message.match(/Could not find template/)) {
                    code = 404;
                }

                return Promise.reject(this.genRestResponse(restOperation, code, e.stack, ctx));
            })
            .then((renderResults) => {
                appsData = renderResults;
            })
            .then(() => {
                appsData.forEach((appData) => {
                    this.generateTeemReportApplication('modify', appData.metaData.template);
                });
            })
            .then(() => this.recordTransaction(
                reqid,
                'requesting new application(s) from the driver',
                this.driver.createApplications(appsData, ctx)
            ))
            .catch((e) => {
                if (restOperation.getStatusCode() >= 400) {
                    return Promise.reject();
                }
                const code = (e.response) ? e.response.status : 500;
                return this.releaseIPAMAddressesFromApps(reqid, appsData, ctx)
                    .then(() => Promise.reject(this.genRestResponse(
                        restOperation,
                        code,
                        `error generating AS3 declaration\n${e.stack}`,
                        ctx
                    )));
            })
            .then((response) => {
                if (response.status >= 300) {
                    return this.genRestResponse(restOperation, response.status, response.body);
                }
                return this.genRestResponse(restOperation, response.status, data.map(
                    x => ({
                        id: response.body.id,
                        name: x.name,
                        parameters: x.parameters
                    })
                ), ctx);
            })
            .catch((e) => {
                if (restOperation.getStatusCode() < 400) {
                    this.genRestResponse(restOperation, 500, e.stack, ctx);
                }
            });
    }

    _validateTemplateSet(tspath) {
        const tmplProvider = new FsTemplateProvider(tspath);
        return tmplProvider.list()
            .then((templateList) => {
                if (templateList.length === 0) {
                    return Promise.reject(new Error('template set contains no templates'));
                }
                return Promise.resolve(templateList);
            })
            .then(templateList => Promise.all(templateList.map(tmpl => tmplProvider.fetch(tmpl))));
    }

    postTemplateSets(restOperation, data, ctx) {
        const tsid = data.name;
        const reqid = restOperation.requestId;
        const setsrc = (this.uploadPath !== '') ? `${this.uploadPath}/${tsid}.zip` : `${tsid}.zip`;
        const scratch = `${this.scratchPath}/${tsid}`;
        const onDiskPath = `${this.templatesPath}/${tsid}`;

        if (!data.name) {
            return this.genRestResponse(restOperation, 400, `invalid template set name supplied: ${tsid}`, ctx);
        }

        // Setup a scratch location we can use while validating the template set
        this.enterTransaction(reqid, 'prepare scratch space');
        fs.removeSync(scratch);
        fs.mkdirsSync(scratch);
        this.exitTransaction(reqid, 'prepare scratch space');

        return Promise.resolve()
            .then(() => {
                if (fs.existsSync(onDiskPath)) {
                    return this.recordTransaction(
                        reqid,
                        'copy template set from disk',
                        fs.copy(onDiskPath, scratch)
                    );
                }

                const setpath = `${scratch}.zip`;
                return Promise.resolve()
                    .then(() => this.recordTransaction(
                        reqid,
                        'fetch uploaded template set',
                        this.bigip.copyUploadedFile(setsrc, setpath, ctx)
                    ))
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
            .then(() => this.recordTransaction(
                reqid,
                'validate template set',
                this._validateTemplateSet(this.scratchPath)
            ))
            .catch(e => Promise.reject(new Error(`Template set (${tsid}) failed validation: ${e.message}. ${e.stack}`)))
            .then(() => this.enterTransaction(reqid, 'write new template set to data store'))
            .then(() => this.templateProvider.invalidateCache())
            .then(() => DataStoreTemplateProvider.fromFs(this.storage, this.scratchPath, [tsid]))
            .then(() => {
                this.generateTeemReportTemplateSet('create', tsid);
            })
            .then(() => this.getConfig(reqid, ctx))
            .then((config) => {
                if (config.deletedTemplateSets.includes(tsid)) {
                    config.deletedTemplateSets = config.deletedTemplateSets.filter(x => x !== tsid);
                    return this.saveConfig(config, reqid, ctx);
                }
                return Promise.resolve();
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
                    'converting applications with old pool_members definition',
                    this.driver.listApplications(ctx)
                        .then(apps => this.convertPoolMembers(reqid, apps))
                );
            })
            .then(() => this.genRestResponse(restOperation, 200, '', ctx))
            .catch((e) => {
                if (e.message.match(/no such file/)) {
                    return this.genRestResponse(restOperation, 404, `${setsrc} does not exist`, ctx);
                }
                if (e.message.match(/failed validation/)) {
                    return this.genRestResponse(restOperation, 400, e.message, ctx);
                }
                return this.genRestResponse(restOperation, 500, e.stack, ctx);
            })
            .finally(() => fs.removeSync(scratch));
    }

    postSettings(restOperation, config, ctx) {
        const reqid = restOperation.requestId;

        return Promise.resolve()
            .then(() => this.validateConfig(config))
            .catch(e => Promise.reject(this.genRestResponse(
                restOperation,
                422,
                `supplied settings were not valid:\n${e.message}`,
                ctx
            )))
            .then(() => this.getConfig(reqid, ctx))
            .then(prevConfig => this.encryptConfigSecrets(config, prevConfig))
            .then(() => this.saveConfig(config, reqid, ctx))
            .then(() => Promise.resolve(this.setTracer(config.perfTracing)))
            .then(() => this.genRestResponse(restOperation, 200, '', ctx))
            .catch((e) => {
                if (restOperation.getStatusCode() < 400) {
                    this.genRestResponse(restOperation, 500, e.stack, ctx);
                }
            });
    }

    postRender(restOperation, data, ctx) {
        const reqid = restOperation.requestId;
        if (!Array.isArray(data)) {
            data = [data];
        }

        // this.logger.info(`postRender() received:\n${JSON.stringify(data, null, 2)}`);

        return Promise.resolve()
            .then(() => this.renderTemplates(reqid, data, ctx))
            .catch((e) => {
                let code = 400;
                if (e.message.match(/Could not find template/)) {
                    code = 404;
                }

                return Promise.reject(this.genRestResponse(restOperation, code, e.stack, ctx));
            })
            .then(rendered => this.releaseIPAMAddressesFromApps(reqid, rendered, ctx)
                .then(() => rendered))
            .then(rendered => this.genRestResponse(restOperation, 200, rendered, ctx))
            .catch((e) => {
                if (restOperation.getStatusCode() < 400) {
                    this.genRestResponse(restOperation, 500, e.stack, ctx);
                }
            });
    }

    onPost(restOperation) {
        const body = restOperation.getBody();
        const uri = restOperation.getUri();
        const pathElements = uri.pathname.split('/');
        const collection = pathElements[3];

        restOperation.requestId = this.generateRequestId();
        const ctx = this.generateContext(restOperation);

        this.recordRestRequest(restOperation);

        return Promise.resolve()
            .then(() => this.handleLazyInit(restOperation.requestId, ctx))
            .then(() => this.validateRequest(restOperation))
            .then(() => {
                try {
                    switch (collection) {
                    case 'applications':
                        return this.postApplications(restOperation, body, ctx);
                    case 'templatesets':
                        return this.postTemplateSets(restOperation, body, ctx);
                    case 'settings':
                        return this.postSettings(restOperation, body, ctx);
                    case 'render':
                        return this.postRender(restOperation, body, ctx);
                    default:
                        return this.genRestResponse(restOperation, 404, `unknown endpoint ${uri.pathname}`, ctx);
                    }
                } catch (e) {
                    return this.genRestResponse(restOperation, 500, e.message, ctx);
                }
            })
            .catch(e => this.genRestResponse(restOperation, 400, e.message, ctx));
    }

    deleteApplications(restOperation, appid, data, ctx) {
        const reqid = restOperation.requestId;
        const uri = restOperation.getUri();
        const pathElements = uri.pathname.split('/');

        if (appid) {
            data = [`${pathElements[4]}/${pathElements[5]}`];
        } else if (!data) {
            data = [];
        }

        if (typeof data === 'string') {
            // convert empty string to an empty array
            data = [];
        }

        const appNames = data.map(x => x.split('/'));
        let appsData;
        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid,
                'requesting application data from driver',
                Promise.all(appNames.map(x => this.driver.getApplication(...x, ctx)))
            ))
            .then((value) => {
                appsData = value;
            })
            .then(() => this.releaseIPAMAddressesFromApps(reqid, appsData, ctx))
            .then(() => this.recordTransaction(
                reqid,
                'deleting applications',
                this.driver.deleteApplications(appNames, ctx)
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
                this.completeRestOperation(restOperation, ctx);
            })
            .then(() => {
                appsData.forEach((appData) => {
                    this.generateTeemReportApplication('delete', appData.template);
                });
            })
            .catch((e) => {
                if (e.message.match('no tenant found')) {
                    return this.genRestResponse(restOperation, 404, e.message, ctx);
                }
                if (e.message.match('could not find application')) {
                    return this.genRestResponse(restOperation, 404, e.message, ctx);
                }
                return this.genRestResponse(restOperation, 500, e.stack, ctx);
            });
    }

    deleteTemplateSets(restOperation, tsid, ctx) {
        const reqid = restOperation.requestId;
        if (tsid) {
            return Promise.resolve()
                .then(() => this.recordTransaction(
                    reqid,
                    `gathering template set data for ${tsid}`,
                    this.gatherTemplateSet(tsid, ctx)
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
                ))
                .then(() => this.getConfig(reqid, ctx))
                .then((config) => {
                    config.deletedTemplateSets.push(tsid);
                    return this.saveConfig(config, reqid, ctx);
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
                .then(() => this.genRestResponse(restOperation, 200, 'success', ctx))
                .catch((e) => {
                    if (e.message.match(/failed to find template set/)) {
                        return this.genRestResponse(restOperation, 404, e.message, ctx);
                    }
                    if (e.message.match(/being used by/)) {
                        return this.genRestResponse(restOperation, 400, e.message, ctx);
                    }
                    return this.genRestResponse(restOperation, 500, e.stack, ctx);
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
                        ));
                });
                return promiseChain
                    .then(() => this.getConfig(reqid, ctx))
                    .then((config) => {
                        config.deletedTemplateSets = [...new Set(config.deletedTemplateSets.concat(setList))];
                        return this.saveConfig(config, reqid, ctx);
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
            .then(() => this.genRestResponse(restOperation, 200, 'success', ctx))
            .catch(e => this.genRestResponse(restOperation, 500, e.stack, ctx));
    }

    deleteSettings(restOperation, ctx) {
        const reqid = restOperation.requestId;
        const defaultConfig = this._getDefaultConfig();
        return Promise.resolve()
            // delete the datagroup;
            .then(() => this.configStorage.deleteItem(configKey))
            // save the default config to create the config datagroup
            .then(() => this.saveConfig(defaultConfig, reqid, ctx))
            .then(() => (this.configStorage instanceof StorageDataGroup
                ? Promise.resolve() : this.configStorage.persist()))
            .then(() => this.genRestResponse(restOperation, 200, 'success', ctx))
            .catch(e => this.genRestResponse(restOperation, 500, e.stack, ctx));
    }

    onDelete(restOperation) {
        const body = restOperation.getBody();
        const uri = restOperation.getUri();
        const pathElements = uri.pathname.split('/');
        const collection = pathElements[3];
        const itemid = pathElements[4];

        restOperation.requestId = this.generateRequestId();
        const ctx = this.generateContext(restOperation);

        this.recordRestRequest(restOperation);

        return Promise.resolve()
            .then(() => this.handleLazyInit(restOperation.requestId, ctx))
            .then(() => this.validateRequest(restOperation))
            .then(() => {
                try {
                    switch (collection) {
                    case 'applications':
                        return this.deleteApplications(restOperation, itemid, body, ctx);
                    case 'templatesets':
                        return this.deleteTemplateSets(restOperation, itemid, ctx);
                    case 'settings':
                        return this.deleteSettings(restOperation, ctx);
                    default:
                        return this.genRestResponse(restOperation, 404, `unknown endpoint ${uri.pathname}`, ctx);
                    }
                } catch (e) {
                    return this.genRestResponse(restOperation, 500, e.stack, ctx);
                }
            })
            .catch(e => this.genRestResponse(restOperation, 400, e.message, ctx));
    }

    patchApplications(restOperation, appid, data, ctx) {
        if (!appid) {
            return Promise.resolve()
                .then(() => this.genRestResponse(restOperation, 400, 'PATCH is not supported on this endpoint', ctx));
        }

        const reqid = restOperation.requestId;
        const uri = restOperation.getUri();
        const pathElements = uri.pathname.split('/');
        const tenant = pathElements[4];
        const app = pathElements[5];
        const newParameters = data.parameters;
        // clone restOp, but make sure to unhook complete op
        const postOp = Object.assign(Object.create(Object.getPrototypeOf(restOperation)), restOperation);
        postOp.complete = () => postOp;
        postOp.setMethod('Post');

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid,
                'Fetching application data from AS3',
                this.driver.getApplication(tenant, app, ctx)
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
                }], ctx)
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
                            `PATCH would change tenant name from ${tenant} to ${tenantName}`,
                            ctx
                        )
                    );
                }
                if (appName !== app) {
                    return Promise.reject(
                        this.genRestResponse(
                            restOperation,
                            422,
                            `PATCH would change application name from ${app} to ${appName}`,
                            ctx
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
                this.genRestResponse(restOperation, postOp.getStatusCode(), respBody, ctx);
            })
            .catch((e) => {
                if (restOperation.getStatusCode() < 400) {
                    this.genRestResponse(restOperation, 500, e.stack, ctx);
                }
            });
    }

    patchSettings(restOperation, config, ctx) {
        const reqid = restOperation.requestId;
        let combinedConfig = {};

        return Promise.resolve()
            .then(() => this.getConfig(reqid, ctx))
            .then(prevConfig => this.encryptConfigSecrets(config, prevConfig)
                .then(() => prevConfig))
            .then((prevConfig) => {
                combinedConfig = Object.assign({}, prevConfig, config);
            })
            .then(() => this.validateConfig(combinedConfig))
            .catch(e => Promise.reject(this.genRestResponse(
                restOperation,
                422,
                `supplied settings were not valid:\n${e.message}`,
                ctx
            )))
            .then(() => this.saveConfig(combinedConfig, reqid, ctx))
            .then(() => Promise.resolve(this.setTracer(combinedConfig.perfTracing)))
            .then(() => this.genRestResponse(restOperation, 200, '', ctx))
            .catch((e) => {
                if (restOperation.getStatusCode() < 400) {
                    this.genRestResponse(restOperation, 500, e.stack, ctx);
                }
            });
    }

    onPatch(restOperation) {
        const body = restOperation.getBody();
        const uri = restOperation.getUri();
        const pathElements = uri.pathname.split('/');
        const collection = pathElements[3];
        const itemid = pathElements[4];

        restOperation.requestId = this.generateRequestId();
        const ctx = this.generateContext(restOperation);

        this.recordRestRequest(restOperation);

        return Promise.resolve()
            .then(() => this.handleLazyInit(restOperation.requestId, ctx))
            .then(() => this.validateRequest(restOperation))
            .then(() => {
                try {
                    switch (collection) {
                    case 'applications':
                        return this.patchApplications(restOperation, itemid, body, ctx);
                    case 'settings':
                        return this.patchSettings(restOperation, body, ctx);
                    default:
                        return this.genRestResponse(restOperation, 404, `unknown endpoint ${uri.pathname}`, ctx);
                    }
                } catch (e) {
                    return this.genRestResponse(restOperation, 500, e.stack, ctx);
                }
            })
            .catch(e => this.genRestResponse(restOperation, 400, e.message, ctx));
    }

    validateRequest(restOperation) {
        const requestContentType = restOperation.getContentType();
        if (['Post', 'Patch'].includes(restOperation.getMethod()) && requestContentType !== 'application/json') {
            return Promise.reject(new Error(`Content-Type application/json is required, got ${requestContentType}`));
        }
        return Promise.resolve();
    }
}

module.exports = FASTWorker;
