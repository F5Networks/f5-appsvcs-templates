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
const https = require('https');
const url = require('url');

const extract = require('extract-zip');
const axios = require('axios');
const Ajv = require('ajv');
const merge = require('deepmerge');
const Mustache = require('mustache');
const semver = require('semver');

const fast = require('@f5devcentral/f5-fast-core');
const TeemDevice = require('@f5devcentral/f5-teem').Device;

const drivers = require('../lib/drivers');
const { SecretsSecureVault } = require('../lib/secrets');

const FsTemplateProvider = fast.FsTemplateProvider;
const DataStoreTemplateProvider = fast.DataStoreTemplateProvider;
const StorageDataGroup = fast.dataStores.StorageDataGroup;
const AS3Driver = drivers.AS3Driver;
const TransactionLogger = fast.TransactionLogger;
const IpamProviders = require('../lib/ipam');

const pkg = require('../package.json');

const endpointName = 'fast';
const projectName = 'f5-appsvcs-templates';
const mainBlockName = 'F5 Application Services Templates';

const bigipHost = (process.env.FAST_BIGIP_HOST && `${process.env.FAST_BIGIP_HOST}`) || 'http://localhost:8100';
const bigipUser = process.env.FAST_BIGIP_USER || 'admin';
const bigipPassword = process.env.FAST_BIGIP_PASSWORD || '';
let bigipStrictCert = process.env.FAST_BIGIP_STRICT_CERT || true;
if (typeof bigipStrictCert === 'string') {
    bigipStrictCert = (
        bigipStrictCert.toLowerCase() === 'true'
        || bigipStrictCert === '1'
    );
}

const ajv = new Ajv({
    useDefaults: true
});
ajv.addFormat('checkbox', /.*/);
ajv.addFormat('table', /.*/);
ajv.addFormat('password', /.*/);
ajv.addFormat('text', /.*/);
ajv.addFormat('grid-strict', /.*/);
ajv.addFormat('textarea', /.*/);

// Disable HTML escaping
Mustache.escape = function escape(text) {
    return text;
};

const configPath = process.AFL_TW_ROOT || `/var/config/rest/iapps/${projectName}`;
const templatesPath = process.AFL_TW_TS || `${configPath}/templatesets`;
const uploadPath = process.env.FAST_UPLOAD_DIR || '/var/config/rest/downloads';
const scratchPath = `${configPath}/scratch`;
const dataGroupPath = `/Common/${projectName}/dataStore`;

const configDGPath = `/Common/${projectName}/config`;
const configKey = 'config';
// Known good hashes for template sets
const supportedHashes = {
    'bigip-fast-templates': [
        'b10bd58a6a1e29650ab1ba04e5214495b66c843c4c0c66360251bce0213c5fdb', // v1.13
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
        this.state = {};

        this.baseUserAgent = `${pkg.name}/${pkg.version}`;
        this.incomingUserAgent = '';

        this.isPublic = true;
        this.isPassThrough = true;
        this.WORKER_URI_PATH = `shared/${endpointName}`;
        this.driver = new AS3Driver({
            endPointUrl: `${bigipHost}/mgmt/shared/appsvcs`,
            userAgent: this.baseUserAgent,
            bigipUser,
            bigipPassword,
            strictCerts: bigipStrictCert
        });
        this.storage = options.templateStorage || new StorageDataGroup(dataGroupPath);
        this.configStorage = options.configStorage || new StorageDataGroup(configDGPath);
        this.templateProvider = new DataStoreTemplateProvider(this.storage, undefined, supportedHashes);
        this.fsTemplateProvider = new FsTemplateProvider(templatesPath, options.fsTemplateList);
        this.teemDevice = new TeemDevice({
            name: projectName,
            version: pkg.version
        });
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

        this.endpoint = axios.create({
            baseURL: bigipHost,
            auth: {
                username: bigipUser,
                password: bigipPassword
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: bigipStrictCert
            })
        });

        this.requestTimes = {};
        this.requestCounter = 1;
        this.provisionData = null;
        this.as3Info = null;
        this._hydrateCache = null;
        this._provisionConfigCache = null;
    }

    hookCompleteRestOp() {
        // Hook completeRestOperation() so we can add additional logging
        this._prevCompleteRestOp = this.completeRestOperation;
        this.completeRestOperation = (restOperation) => {
            this.recordRestResponse(restOperation);
            return this._prevCompleteRestOp(restOperation);
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

    getConfig(reqid) {
        reqid = reqid || 0;
        const defaultConfig = {
            deletedTemplateSets: [],
            enableIpam: false,
            ipamProviders: [],
            disableDeclarationCache: false
        };
        return Promise.resolve()
            .then(() => this.enterTransaction(reqid, 'gathering config data'))
            .then(() => Promise.all([
                this.configStorage.getItem(configKey),
                this.driver.getSettings()
            ]))
            .then(([config, driverSettings]) => {
                if (config) {
                    return Promise.resolve(Object.assign(
                        {},
                        defaultConfig,
                        driverSettings,
                        config
                    ));
                }
                return Promise.resolve()
                    .then(() => {
                        this.logger.info('FAST Worker: no config found, loading defaults');
                    })
                    .then(() => this.configStorage.setItem(configKey, defaultConfig))
                    .then(() => this.configStorage.persist())
                    .then(() => defaultConfig);
            })
            .then((config) => {
                this.exitTransaction(reqid, 'gathering config data');
                return Promise.resolve(config);
            })
            .catch((e) => {
                this.logger.severe(`FAST Worker: Failed to load config: ${e.stack}`);
                return Promise.resolve(defaultConfig);
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
                }
            },
            required: [
                'deletedTemplateSets'
            ]
        };

        baseSchema = fast.guiUtils.modSchemaForJSONEditor(baseSchema);

        return merge(this.driver.getSettingsSchema(), baseSchema);
    }

    saveConfig(config, reqid) {
        reqid = reqid || 0;
        let prevConfig;
        return Promise.resolve()
            .then(() => this.enterTransaction(reqid, 'saving config data'))
            .then(() => this.configStorage.getItem(configKey, config))
            .then((data) => {
                prevConfig = data;
            })
            .then(() => this.configStorage.setItem(configKey, config))
            .then(() => {
                if (JSON.stringify(prevConfig) !== JSON.stringify(config)) {
                    return this.recordTransaction(
                        reqid, 'persisting config',
                        this.configStorage.persist()
                    );
                }

                return Promise.resolve();
            })
            .then(() => this.exitTransaction(reqid, 'saving config data'))
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

        this.logger.fine(`FAST Worker: Starting ${pkg.name} v${pkg.version}`);
        this.logger.fine(`FAST Worker: Targetting ${bigipHost}`);
        const startTime = Date.now();
        let config;
        let saveState = true;

        return Promise.resolve()
            // Automatically add a block
            .then(() => {
                const hosturl = url.parse(bigipHost);
                if (hosturl.hostname !== 'localhost') {
                    return Promise.resolve();
                }

                return Promise.resolve()
                    .then(() => this.enterTransaction(0, 'ensure FAST is in iApps blocks'))
                    .then(() => this.endpoint.get('/mgmt/shared/iapp/blocks'))
                    .catch(e => this.handleResponseError(e, 'to get blocks'))
                    .then((results) => {
                        const matchingBlocks = results.data.items.filter(x => x.name === mainBlockName);
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
                            return this.endpoint.post('/mgmt/shared/iapp/blocks', blockData);
                        }

                        // Found a block, do nothing
                        return Promise.resolve({ status: 200 });
                    })
                    .catch(e => this.handleResponseError(e, 'to set block state'))
                    .then(() => this.exitTransaction(0, 'ensure FAST is in iApps blocks'));
            })
            // Load config
            .then(() => this.getConfig(0))
            .then((cfg) => {
                config = cfg;
            })
            .then(() => this.setDeviceInfo())
            // Get the AS3 driver ready
            .then(() => this.recordTransaction(
                0, 'ready AS3 driver',
                this.driver.loadMixins()
            ))
            .then(() => this.recordTransaction(
                0, 'sync AS3 driver settings',
                Promise.resolve()
                    .then(() => this.gatherProvisionData(0, false, true))
                    .then(provisionData => this.driver.setSettings(config, provisionData, true))
                    .then(() => this.saveConfig(config, 0))
            ))
            // Load template sets from disk (i.e., those from the RPM)
            .then(() => this.enterTransaction(0, 'loading template sets from disk'))
            .then(() => this.recordTransaction(
                0, 'gather list of templates from disk',
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
                return DataStoreTemplateProvider.fromFs(this.storage, templatesPath, sets);
            })
            .then(() => this.exitTransaction(0, 'loading template sets from disk'))
            // Persist any template set changes
            .then(() => saveState && this.recordTransaction(0, 'persist template data store', this.storage.persist()))
            // Done
            .then(() => {
                const dt = Date.now() - startTime;
                this.logger.fine(`FAST Worker: Startup completed in ${dt}ms`);
            })
            .then(() => success())
            // Errors
            .catch((e) => {
                this.logger.severe(`FAST Worker: Failed to start: ${e.stack}`);
                error();
            });
    }

    onStartCompleted(success, error, _loadedState, errMsg) {
        if (typeof errMsg === 'string' && errMsg !== '') {
            this.logger.error(`FAST Worker onStart error: ${errMsg}`);
            return error();
        }
        this.generateTeemReportOnStart();
        return success();
    }

    setDeviceInfo() {
        // If device-info is unavailable intermittently, this can be placed in onStart
        // and call setDeviceInfo in onStartCompleted
        // this.dependencies.push(this.restHelper.makeRestjavadUri(
        //     '/shared/identified-devices/config/device-info'
        // ));
        return Promise.resolve()
            .then(() => this.recordTransaction(0, 'fetching device information',
                this.endpoint.get('/mgmt/shared/identified-devices/config/device-info'))
                .then((response) => {
                    const data = response.data;
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
                }));
    }

    /**
     * TEEM Report Generators
     */
    sendTeemReport(reportName, reportVersion, data) {
        const documentName = `${projectName}: ${reportName}`;
        const baseData = {
            userAgent: this.incomingUserAgent
        };
        return this.teemDevice.report(documentName, `${reportVersion}`, baseData, data)
            .catch(e => this.logger.error(`FAST Worker failed to send telemetry data: ${e.stack}`));
    }

    generateTeemReportOnStart() {
        return this.gatherInfo()
            .then(info => this.sendTeemReport('onStart', 1, info))
            .catch(e => this.logger.error(`FAST Worker failed to send telemetry data: ${e.stack}`));
    }

    generateTeemReportApplication(action, templateName) {
        const report = {
            action,
            templateName
        };
        return Promise.resolve()
            .then(() => this.sendTeemReport('Application Management', 1, report))
            .catch(e => this.logger.error(`FAST Worker failed to send telemetry data: ${e.stack}`));
    }

    generateTeemReportTemplateSet(action, templateSetName) {
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

    gatherTemplateSet(tsid) {
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
            this.driver.listApplications()
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

    gatherInfo(requestId) {
        requestId = requestId || 0;
        const info = {
            version: pkg.version,
            as3Info: {},
            installedTemplates: []
        };

        return Promise.resolve()
            .then(() => this.recordTransaction(
                requestId, 'GET to appsvcs/info',
                this.endpoint.get('/mgmt/shared/appsvcs/info', {
                    validateStatus: () => true // ignore failure status codes
                })
            ))
            .then((as3response) => {
                info.as3Info = as3response.data;
                this.as3Info = info.as3Info;
            })
            .then(() => this.enterTransaction(requestId, 'gathering template set data'))
            .then(() => this.templateProvider.listSets())
            .then(setList => Promise.all(setList.map(setName => this.gatherTemplateSet(setName))))
            .then((tmplSets) => {
                info.installedTemplates = tmplSets;
            })
            .then(() => this.exitTransaction(requestId, 'gathering template set data'))
            .then(() => this.getConfig(requestId))
            .then((config) => {
                info.config = config;
            })
            .then(() => info);
    }

    gatherProvisionData(requestId, clearCache, skipAS3) {
        if (clearCache) {
            this.provisionData = null;
            this._provisionConfigCache = null;
        }
        return Promise.resolve()
            .then(() => {
                if (this.provisionData !== null) {
                    return Promise.resolve(this.provisionData);
                }

                return this.recordTransaction(
                    requestId, 'Fetching module provision information',
                    this.endpoint.get('/mgmt/tm/sys/provision')
                )
                    .then(response => response.data);
            })
            .then((response) => {
                this.provisionData = response;
            })
            .then(() => {
                if (this._provisionConfigCache !== null) {
                    return Promise.resolve(this._provisionConfigCache);
                }

                return this.getConfig(requestId);
            })
            .then((config) => {
                this._provisionConfigCache = config;
            })
            .then(() => {
                const tsInfo = this.provisionData.items.filter(x => x.name === 'ts')[0];
                if (tsInfo) {
                    return Promise.resolve({ status: (tsInfo.level === 'nominal') ? 200 : 404 });
                }

                return this.recordTransaction(
                    requestId, 'Fetching TS module information',
                    this.endpoint.get('/mgmt/shared/telemetry/info', {
                        validateStatus: () => true // ignore failure status codes
                    })
                );
            })
            .then((response) => {
                const config = this._provisionConfigCache;
                this.provisionData.items.push({
                    name: 'ts',
                    level: (response.status === 200 && config.enable_telemetry) ? 'nominal' : 'none'
                });
            })
            .then(() => {
                if (skipAS3 || (this.as3Info !== null && this.as3Info.version)) {
                    return Promise.resolve(this.as3Info);
                }
                return this.recordTransaction(
                    requestId, 'Fetching AS3 info',
                    this.endpoint.get('/mgmt/shared/appsvcs/info', {
                        validateStatus: () => true // ignore failure status codes
                    })
                )
                    .then(response => response.data);
            })
            .then((response) => {
                this.as3Info = response;
            })
            .then(() => Promise.all([
                Promise.resolve(this.provisionData),
                Promise.resolve(this.as3Info)
            ]));
    }

    checkDependencies(tmpl, requestId, clearCache) {
        return Promise.resolve()
            .then(() => this.gatherProvisionData(requestId, clearCache))
            .then(([provisionData, as3Info]) => {
                const provisionedModules = provisionData.items.filter(x => x.level !== 'none').map(x => x.name);
                const as3Version = semver.coerce(as3Info.version || '0.0');
                const tmplAs3Version = semver.coerce(tmpl.bigipMinimumAS3 || '3.16');
                const deps = tmpl.bigipDependencies || [];
                const missingModules = deps.filter(x => !provisionedModules.includes(x));
                if (missingModules.length > 0) {
                    return Promise.reject(new Error(
                        `could not load template (${tmpl.title}) due to missing modules: ${missingModules}`
                    ));
                }

                if (!semver.gte(as3Version, tmplAs3Version)) {
                    return Promise.reject(new Error(
                        `could not load template (${tmpl.title}) since it requires`
                        + ` AS3 >= ${tmpl.bigipMinimumAS3} (found ${as3Version})`
                    ));
                }

                let promiseChain = Promise.resolve();
                tmpl._allOf.forEach((subtmpl) => {
                    promiseChain = promiseChain
                        .then(() => this.checkDependencies(subtmpl, requestId));
                });
                const validOneOf = [];
                let errstr = '';
                tmpl._oneOf.forEach((subtmpl) => {
                    promiseChain = promiseChain
                        .then(() => this.checkDependencies(subtmpl, requestId))
                        .then(() => {
                            validOneOf.push(subtmpl);
                        })
                        .catch((e) => {
                            if (!e.message.match(/due to missing modules/)) {
                                return Promise.reject(e);
                            }
                            errstr = `\n${errstr}`;
                            return Promise.resolve();
                        });
                });
                promiseChain = promiseChain
                    .then(() => {
                        if (tmpl._oneOf.length > 0 && validOneOf.length === 0) {
                            return Promise.reject(new Error(
                                `could not load template since no oneOf had valid dependencies:${errstr}`
                            ));
                        }
                        tmpl._oneOf = validOneOf;
                        return Promise.resolve();
                    });
                const validAnyOf = [];
                tmpl._anyOf.forEach((subtmpl) => {
                    promiseChain = promiseChain
                        .then(() => this.checkDependencies(subtmpl, requestId))
                        .then(() => {
                            validAnyOf.push(subtmpl);
                        })
                        .catch((e) => {
                            if (!e.message.match(/due to missing modules/)) {
                                return Promise.reject(e);
                            }
                            return Promise.resolve();
                        });
                });
                promiseChain = promiseChain
                    .then(() => {
                        tmpl._anyOf = validAnyOf;
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
            .then(() => Promise.all(subTemplates.map(x => this.hydrateSchema(x, requestId))))
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
                const epStubs = Array.isArray(prop.enumFromBigip) ? prop.enumFromBigip : [prop.enumFromBigip];
                const endPoints = epStubs.map(x => `/mgmt/tm/${x}?$select=fullPath`);
                return Promise.resolve()
                    .then(() => Promise.all(endPoints.map(endPoint => Promise.resolve()
                        .then(() => {
                            if (this._hydrateCache[endPoint]) {
                                return this._hydrateCache[endPoint];
                            }

                            return this.recordTransaction(
                                requestId, `fetching data from ${endPoint}`,
                                this.endpoint.get(endPoint)
                            )
                                .then((response) => {
                                    const items = response.data.items;
                                    this._hydrateCache[endPoint] = items;
                                    return items;
                                });
                        })
                        .then((items) => {
                            if (items) {
                                return Promise.resolve(items.map(x => x.fullPath));
                            }
                            return Promise.resolve([]);
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

    convertPoolMembers(reqid, apps) {
        reqid = reqid || 0;
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

        if (newApps.length > 0) {
            promiseChain = promiseChain
                .then(() => this.recordTransaction(
                    reqid, 'Updating pool members',
                    this.endpoint.post(`/mgmt/${this.WORKER_URI_PATH}/applications/`, newApps.map(app => ({
                        name: app.template,
                        parameters: app.view
                    })))
                ))
                .then((resp) => {
                    this.logger.info(
                        `FAST Worker [${reqid}]: task ${resp.data.message[0].id} submitted to update pool_members`
                    );
                });
        }

        return promiseChain
            .then(() => apps);
    }

    releaseIPAMAddressesFromApps(reqid, appsData) {
        let config;
        const promises = [];
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
            promises.push(Promise.resolve()
                .then(() => {
                    if (config) {
                        return Promise.resolve(config);
                    }
                    return this.getConfig(reqid)
                        .then((c) => { config = c; });
                })
                .then(() => this.ipamProviders.releaseIPAMAddress(reqid, config, view)));
        });

        return Promise.all(promises);
    }

    fetchTemplate(reqid, tmplid) {
        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid, 'fetching template',
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
            .then(() => this.driver.listApplicationNames())
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
                    reqid, `fetching template set data for ${setName}`,
                    this.templateProvider.getSetData(setName)
                ))
                .then(setData => Object.assign(tsData, setData))
                .then(() => this.fetchTemplate(reqid, tmplData.name))
                .catch(e => Promise.reject(new Error(`unable to load template: ${tmplData.name}\n${e.stack}`)))
                .then((tmpl) => {
                    const schema = tmpl.getParametersSchema();
                    const ipFromIpamProps = this.getPropsWithChild(schema, 'ipFromIpam', true);
                    return this.ipamProviders.populateIPAMAddress(ipFromIpamProps, tmplData, config, reqid, ipamAddrs)
                        .then(() => tmpl);
                })
                .then(tmpl => this.recordTransaction(
                    reqid, `rendering template (${tmplData.name})`,
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
                        this.ipamProviders.releaseIPAMAddress(reqid, config, oldAppData, ipamAddrs);
                    }
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
        // Update driver's user agent if one was provided with the request
        const userAgent = restOp.getUri().query.userAgent;
        this.incomingUserAgent = userAgent || '';
        this.driver.userAgent = userAgent ? `${userAgent};${this.baseUserAgent}` : this.baseUserAgent;

        // Record the time we received the request
        this.requestTimes[restOp.requestId] = Date.now();

        // Dump information to the log
        this.logger.fine(
            `FAST Worker [${restOp.requestId}]: received request method=${restOp.getMethod()}; path=${restOp.getUri().pathname}; userAgent=${this.incomingUserAgent}`
        );
    }

    recordRestResponse(restOp) {
        const minOp = {
            method: restOp.getMethod(),
            path: restOp.getUri().pathname,
            status: restOp.getStatusCode()
        };
        const dt = Date.now() - this.requestTimes[restOp.requestId];
        const msg = `FAST Worker [${restOp.requestId}]: sending response after ${dt}ms\n${JSON.stringify(minOp, null, 2)}`;
        delete this.requestTimes[restOp.requestId];
        if (minOp.status >= 400) {
            this.logger.info(msg);
        } else {
            this.logger.fine(msg);
        }
    }

    genRestResponse(restOperation, code, message) {
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
            message
        });
        this.completeRestOperation(restOperation);
        if (code >= 400) {
            this.generateTeemReportError(restOperation);
        }
        return Promise.resolve();
    }

    getInfo(restOperation) {
        return Promise.resolve()
            .then(() => this.gatherInfo(restOperation.requestId))
            .then((info) => {
                restOperation.setBody(info);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.stack));
    }

    getTemplates(restOperation, tmplid) {
        const reqid = restOperation.requestId;
        if (tmplid) {
            const uri = restOperation.getUri();
            const pathElements = uri.pathname.split('/');
            tmplid = pathElements.slice(4, 6).join('/');

            return Promise.resolve()
                .then(() => this.fetchTemplate(reqid, tmplid))
                .then((tmpl) => {
                    restOperation.setBody(tmpl);
                    this.completeRestOperation(restOperation);
                })
                .catch((e) => {
                    if (e.message.match(/Could not find template/)) {
                        return this.genRestResponse(restOperation, 404, e.stack);
                    }
                    return this.genRestResponse(restOperation, 400, `Error: Failed to load template ${tmplid}\n${e.stack}`);
                });
        }

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid, 'fetching template list',
                this.templateProvider.list()
                    .then(tmplList => this.filterTemplates(tmplList))
            ))
            .then((templates) => {
                restOperation.setBody(templates);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.stack));
    }

    getApplications(restOperation, appid) {
        const reqid = restOperation.requestId;
        if (appid) {
            const uri = restOperation.getUri();
            const pathElements = uri.pathname.split('/');
            const tenant = pathElements[4];
            const app = pathElements[5];
            return Promise.resolve()
                .then(() => this.recordTransaction(
                    reqid, 'GET request to appsvcs/declare',
                    this.endpoint.get('/mgmt/shared/appsvcs/declare')
                ))
                .then(resp => resp.data[tenant][app])
                .then(appDef => this.convertPoolMembers(reqid, [appDef]))
                .then((appDefs) => {
                    restOperation.setBody(appDefs[0]);
                    this.completeRestOperation(restOperation);
                })
                .catch(e => this.genRestResponse(restOperation, 404, e.stack));
        }

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid, 'gathering a list of applications from the driver',
                this.driver.listApplications()
            ))
            .then(appsList => this.convertPoolMembers(reqid, appsList))
            .then((appsList) => {
                restOperation.setBody(appsList);
                this.completeRestOperation(restOperation);
            });
    }

    getTasks(restOperation, taskid) {
        const reqid = restOperation.requestId;
        if (taskid) {
            return Promise.resolve()
                .then(() => this.recordTransaction(
                    reqid, 'gathering a list of tasks from the driver',
                    this.driver.getTasks()
                ))
                .then(taskList => taskList.filter(x => x.id === taskid))
                .then((taskList) => {
                    if (taskList.length === 0) {
                        return this.genRestResponse(restOperation, 404, `unknown task ID: ${taskid}`);
                    }
                    restOperation.setBody(taskList[0]);
                    this.completeRestOperation(restOperation);
                    return Promise.resolve();
                })
                .catch(e => this.genRestResponse(restOperation, 500, e.stack));
        }

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid, 'gathering a list of tasks from the driver',
                this.driver.getTasks()
            ))
            .then((tasksList) => {
                restOperation.setBody(tasksList);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.stack));
    }

    getTemplateSets(restOperation, tsid) {
        const queryParams = restOperation.getUri().query;
        const showDisabled = queryParams.showDisabled || false;
        const reqid = restOperation.requestId;
        if (tsid) {
            return Promise.resolve()
                .then(() => this.recordTransaction(
                    reqid, 'gathering a template set',
                    this.gatherTemplateSet(tsid)
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
                        return this.genRestResponse(restOperation, 404, e.message);
                    }
                    return this.genRestResponse(restOperation, 500, e.stack);
                });
        }

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid, 'gathering a list of template sets',
                (showDisabled) ? this.fsTemplateProvider.listSets() : this.templateProvider.listSets()
            ))
            .then(setList => this.recordTransaction(
                reqid, 'gathering data for each template set',
                Promise.all(setList.map(x => this.gatherTemplateSet(x)))
            ))
            .then(setList => ((showDisabled) ? setList.filter(x => !x.enabled) : setList))
            .then((setList) => {
                restOperation.setBody(setList);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.stack));
    }

    getSettings(restOperation) {
        const reqid = restOperation.requestId;
        return Promise.resolve()
            .then(() => this.getConfig(reqid))
            .then((config) => {
                restOperation.setBody(config);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.stack));
    }

    getSettingsSchema(restOperation) {
        return Promise.resolve()
            .then(() => {
                const schema = this.getConfigSchema();
                restOperation.setBody(schema);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.stack));
    }

    onGet(restOperation) {
        const uri = restOperation.getUri();
        const pathElements = uri.pathname.split('/');
        const collection = pathElements[3];
        const itemid = pathElements[4];
        restOperation.requestId = this.generateRequestId();

        this.recordRestRequest(restOperation);

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
                return this.genRestResponse(restOperation, 404, `unknown endpoint ${uri.pathname}`);
            }
        } catch (e) {
            return this.genRestResponse(restOperation, 500, e.stack);
        }
    }

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

                return Promise.reject(this.genRestResponse(restOperation, code, e.stack));
            })
            .then((renderResults) => {
                appsData = renderResults;
            })
            .then(() => {
                appsData.forEach((appData) => {
                    this.generateTeemReportApplication('modify', appData.template);
                });
                return appsData;
            })
            .then(() => this.recordTransaction(
                reqid, 'requesting new application(s) from the driver',
                this.driver.createApplications(appsData)
            ))
            .catch((e) => {
                if (restOperation.getStatusCode() >= 400) {
                    return Promise.reject();
                }
                return this.releaseIPAMAddressesFromApps(reqid, appsData)
                    .then(() => Promise.reject(this.genRestResponse(
                        restOperation,
                        400,
                        `error generating AS3 declaration\n${e.stack}`
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
                ));
            })
            .catch((e) => {
                if (restOperation.getStatusCode() < 400) {
                    this.genRestResponse(restOperation, 500, e.stack);
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

    postTemplateSets(restOperation, data) {
        const tsid = data.name;
        const reqid = restOperation.requestId;
        const setpath = `${uploadPath}/${tsid}.zip`;
        const scratch = `${scratchPath}/${tsid}`;
        const onDiskPath = `${templatesPath}/${tsid}`;

        if (!data.name) {
            return this.genRestResponse(restOperation, 400, `invalid template set name supplied: ${tsid}`);
        }

        if (!fs.existsSync(setpath) && !fs.existsSync(onDiskPath)) {
            return this.genRestResponse(restOperation, 404, `${setpath} does not exist`);
        }

        // Setup a scratch location we can use while validating the template set
        this.enterTransaction(reqid, 'prepare scratch space');
        fs.removeSync(scratch);
        fs.mkdirsSync(scratch);
        this.exitTransaction(reqid, 'prepare scratch space');

        return Promise.resolve()
            .then(() => this.enterTransaction(reqid, 'extract template set'))
            .then(() => {
                if (fs.existsSync(onDiskPath)) {
                    return fs.copy(onDiskPath, scratch);
                }

                return new Promise((resolve, reject) => {
                    extract(setpath, { dir: scratch }, (err) => {
                        if (err) return reject(err);
                        return resolve();
                    });
                });
            })
            .then(() => this.exitTransaction(reqid, 'extract template set'))
            .then(() => this.recordTransaction(
                reqid, 'validate template set',
                this._validateTemplateSet(scratchPath)
            ))
            .catch(e => Promise.reject(new Error(`Template set (${tsid}) failed validation: ${e.message}. ${e.stack}`)))
            .then(() => this.enterTransaction(reqid, 'write new template set to data store'))
            .then(() => this.templateProvider.invalidateCache())
            .then(() => DataStoreTemplateProvider.fromFs(this.storage, scratchPath, [tsid]))
            .then(() => {
                this.generateTeemReportTemplateSet('create', tsid);
            })
            .then(() => this.storage.persist())
            .then(() => this.storage.keys()) // Regenerate the cache, might as well take the hit here
            .then(() => this.exitTransaction(reqid, 'write new template set to data store'))
            .then(() => this.getConfig(reqid))
            .then((config) => {
                if (config.deletedTemplateSets.includes(tsid)) {
                    config.deletedTemplateSets = config.deletedTemplateSets.filter(x => x !== tsid);
                    return this.saveConfig(config, reqid);
                }
                return Promise.resolve();
            })
            // Automatically convert any apps using the old pool_members definition
            .then(() => {
                if (tsid !== 'bigip-fast-templates') {
                    return Promise.resolve();
                }

                return this.recordTransaction(
                    reqid, 'converting applications with old pool_members definition',
                    this.convertPoolMembers(reqid)
                );
            })
            .then(() => this.genRestResponse(restOperation, 200, ''))
            .catch((e) => {
                if (e.message.match(/failed validation/)) {
                    return this.genRestResponse(restOperation, 400, e.message);
                }
                return this.genRestResponse(restOperation, 500, e.stack);
            })
            .finally(() => fs.removeSync(scratch));
    }

    postSettings(restOperation, config) {
        const reqid = restOperation.requestId;

        return Promise.resolve()
            .then(() => this.validateConfig(config))
            .catch(e => Promise.reject(this.genRestResponse(
                restOperation, 422,
                `supplied settings were not valid:\n${e.message}`
            )))
            .then(() => this.getConfig(reqid))
            .then(prevConfig => this.encryptConfigSecrets(config, prevConfig))
            .then(() => this.gatherProvisionData(reqid, true))
            .then(provisionData => this.driver.setSettings(config, provisionData))
            .then(() => this.saveConfig(config, reqid))
            .then(() => this.genRestResponse(restOperation, 200, ''))
            .catch((e) => {
                if (restOperation.getStatusCode() < 400) {
                    this.genRestResponse(restOperation, 500, e.stack);
                }
            });
    }

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

                return Promise.reject(this.genRestResponse(restOperation, code, e.stack));
            })
            .then(rendered => this.releaseIPAMAddressesFromApps(reqid, rendered)
                .then(() => rendered))
            .then(rendered => this.genRestResponse(restOperation, 200, rendered))
            .catch((e) => {
                if (restOperation.getStatusCode() < 400) {
                    this.genRestResponse(restOperation, 500, e.stack);
                }
            });
    }

    onPost(restOperation) {
        const body = restOperation.getBody();
        const uri = restOperation.getUri();
        const pathElements = uri.pathname.split('/');
        const collection = pathElements[3];

        restOperation.requestId = this.generateRequestId();

        this.recordRestRequest(restOperation);

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
            default:
                return this.genRestResponse(restOperation, 404, `unknown endpoint ${uri.pathname}`);
            }
        } catch (e) {
            return this.genRestResponse(restOperation, 500, e.message);
        }
    }

    deleteApplications(restOperation, appid, data) {
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
        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid, 'requesting application data from driver',
                Promise.all(appNames.map(x => this.driver.getApplication(...x)))
            ))
            .then(appsData => this.releaseIPAMAddressesFromApps(reqid, appsData))
            .then(() => this.recordTransaction(
                reqid, 'deleting applications',
                this.driver.deleteApplications(appNames)
            ))
            .then((result) => {
                restOperation.setHeaders('Content-Type', 'text/json');
                restOperation.setBody(result.body);
                restOperation.setStatusCode(result.status);
                this.completeRestOperation(restOperation);
            })
            .then(() => {
                this.generateTeemReportApplication('delete', '');
            })
            .catch((e) => {
                if (e.message.match('no tenant found')) {
                    return this.genRestResponse(restOperation, 404, e.message);
                }
                if (e.message.match('could not find application')) {
                    return this.genRestResponse(restOperation, 404, e.message);
                }
                return this.genRestResponse(restOperation, 500, e.stack);
            });
    }

    deleteTemplateSets(restOperation, tsid) {
        const reqid = restOperation.requestId;
        if (tsid) {
            return Promise.resolve()
                .then(() => this.recordTransaction(
                    reqid, `gathering template set data for ${tsid}`,
                    this.gatherTemplateSet(tsid)
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
                    reqid, 'deleting a template set from the data store',
                    this.templateProvider.removeSet(tsid)
                ))
                .then(() => this.getConfig(reqid))
                .then((config) => {
                    config.deletedTemplateSets.push(tsid);
                    return this.saveConfig(config, reqid);
                })
                .then(() => {
                    this.generateTeemReportTemplateSet('delete', tsid);
                })
                .then(() => this.recordTransaction(
                    reqid, 'persisting the data store',
                    this.storage.persist()
                        .then(() => this.storage.keys()) // Regenerate the cache, might as well take the hit here
                ))
                .then(() => this.genRestResponse(restOperation, 200, 'success'))
                .catch((e) => {
                    if (e.message.match(/failed to find template set/)) {
                        return this.genRestResponse(restOperation, 404, e.message);
                    }
                    if (e.message.match(/being used by/)) {
                        return this.genRestResponse(restOperation, 400, e.message);
                    }
                    return this.genRestResponse(restOperation, 500, e.stack);
                });
        }

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid, 'gathering a list of template sets',
                this.templateProvider.listSets()
            ))
            .then((setList) => {
                let promiseChain = Promise.resolve();
                setList.forEach((set) => {
                    promiseChain = promiseChain
                        .then(() => this.recordTransaction(
                            reqid, `deleting template set: ${set}`,
                            this.templateProvider.removeSet(set)
                        ));
                });
                return promiseChain
                    .then(() => this.recordTransaction(
                        reqid, 'persisting the data store',
                        this.storage.persist()
                    ))
                    .then(() => this.getConfig(reqid))
                    .then((config) => {
                        config.deletedTemplateSets = [...new Set(config.deletedTemplateSets.concat(setList))];
                        return this.saveConfig(config, reqid);
                    });
            })
            .then(() => this.genRestResponse(restOperation, 200, 'success'))
            .catch(e => this.genRestResponse(restOperation, 500, e.stack));
    }

    deleteSettings(restOperation) {
        return Promise.resolve()
            .then(() => this.configStorage.deleteItem(configKey))
            .then(() => this.genRestResponse(restOperation, 200, 'success'))
            .catch(e => this.genRestResponse(restOperation, 500, e.stack));
    }

    onDelete(restOperation) {
        const body = restOperation.getBody();
        const uri = restOperation.getUri();
        const pathElements = uri.pathname.split('/');
        const collection = pathElements[3];
        const itemid = pathElements[4];

        restOperation.requestId = this.generateRequestId();

        this.recordRestRequest(restOperation);

        try {
            switch (collection) {
            case 'applications':
                return this.deleteApplications(restOperation, itemid, body);
            case 'templatesets':
                return this.deleteTemplateSets(restOperation, itemid);
            case 'settings':
                return this.deleteSettings(restOperation);
            default:
                return this.genRestResponse(restOperation, 404, `unknown endpoint ${uri.pathname}`);
            }
        } catch (e) {
            return this.genRestResponse(restOperation, 500, e.stack);
        }
    }

    patchApplications(restOperation, appid, data) {
        if (!appid) {
            return Promise.resolve()
                .then(() => this.genRestResponse(
                    restOperation, 400, 'PATCH is not supported on this endpoint'
                ));
        }

        const reqid = restOperation.requestId;
        const uri = restOperation.getUri();
        const pathElements = uri.pathname.split('/');
        const tenant = pathElements[4];
        const app = pathElements[5];
        const newParameters = data.parameters;

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid, 'Fetching application data from AS3',
                this.driver.getApplication(tenant, app)
            ))
            .then(appData => this.recordTransaction(
                reqid, 'Re-deploying application',
                this.endpoint.post(`/mgmt/${this.WORKER_URI_PATH}/applications`, {
                    name: appData.template,
                    parameters: Object.assign({}, appData.view, newParameters)
                })
            ))
            .then(resp => this.genRestResponse(restOperation, resp.status, resp.data))
            .catch(e => this.genRestResponse(restOperation, 500, e.stack));
    }

    patchSettings(restOperation, config) {
        const reqid = restOperation.requestId;
        let combinedConfig = {};

        return Promise.resolve()
            .then(() => this.getConfig(reqid))
            .then(prevConfig => this.encryptConfigSecrets(config, prevConfig)
                .then(() => prevConfig))
            .then((prevConfig) => {
                combinedConfig = Object.assign({}, prevConfig, config);
            })
            .then(() => this.validateConfig(combinedConfig))
            .catch(e => Promise.reject(this.genRestResponse(
                restOperation, 422,
                `supplied settings were not valid:\n${e.message}`
            )))
            .then(() => this.gatherProvisionData(reqid, true))
            .then(provisionData => this.driver.setSettings(combinedConfig, provisionData))
            .then(() => this.saveConfig(combinedConfig, reqid))
            .then(() => this.genRestResponse(restOperation, 200, ''))
            .catch((e) => {
                if (restOperation.getStatusCode() < 400) {
                    this.genRestResponse(restOperation, 500, e.stack);
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

        this.recordRestRequest(restOperation);

        try {
            switch (collection) {
            case 'applications':
                return this.patchApplications(restOperation, itemid, body);
            case 'settings':
                return this.patchSettings(restOperation, body);
            default:
                return this.genRestResponse(restOperation, 404, `unknown endpoint ${uri.pathname}`);
            }
        } catch (e) {
            return this.genRestResponse(restOperation, 500, e.stack);
        }
    }
}

module.exports = FASTWorker;
