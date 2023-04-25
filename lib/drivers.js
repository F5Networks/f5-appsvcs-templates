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
const axiosRetry = require('axios-retry');
const uuid = require('uuid');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const util = require('util');

const fast = require('@f5devcentral/f5-fast-core');

const AS3DriverConstantsKey = 'fast';

function _appFromDecl(declaration, tenant, app) {
    const as3App = declaration[tenant][app];
    const fastApp = (as3App.constants && as3App.constants[AS3DriverConstantsKey]) || {};
    return Object.assign({}, fastApp, {
        tenant,
        name: app
    });
}

/** Class representing an AS3 Task. */
class Task {
    constructor(options) {
        options = options || {};
        this.id = options.id || null;
        this.taskData = options.taskData || null;
        this.code = options.code || 202;
        this.message = options.message || 'pending';
        this.name = options.name || '';
        this.parameters = options.parameters || {};
        this.tenant = options.tenant || '';
        this.application = options.application || '';
        this.operation = options.operation || 'unknown';
        this.timestamp = options.timestamp || new Date().toISOString();
        this.host = options.host || 'unknown';
    }

    /**
     * return Task as json
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            code: this.code,
            message: this.message,
            name: this.name,
            parameters: this.parameters,
            tenant: this.tenant,
            application: this.application,
            operation: this.operation,
            timestamp: this.timestamp,
            host: this.host
        };
    }

    /**
     * get Task from AS3
     * @param {Object} as3Task - task returned from AS3 request
     * @returns {Object}
     */
    static fromAS3(as3Task) {
        const declid = as3Task.declaration.id;
        const task = new Task({
            id: as3Task.id
        });
        let results = as3Task.results;

        if (declid) {
            const splitChar = (declid.search(/%/) !== -1) ? '%' : '-';
            const idParts = declid.split(splitChar);
            if (splitChar === '-' && idParts.length < 9) {
                [task.tenant, task.application] = idParts.slice(1, 3);
            } else {
                [task.operation, task.tenant, task.application] = idParts.slice(1, 4);
            }
            if (results.length > 0) {
                task.host = results[0].host || 'localhost';
            }
            results = results.filter(r => r.tenant === task.tenant);
            if (results.length === 0) {
                results = as3Task.results;
            }
            if (as3Task.declaration[task.tenant] && as3Task.declaration[task.tenant][task.application]) {
                const appDef = _appFromDecl(as3Task.declaration, task.tenant, task.application);
                task.name = appDef.template;
                task.parameters = appDef.view;
                task.appsData = [appDef];
            }
        }
        const changes = [...new Set(results.filter(r => r.message).map(r => r.message))];
        const responses = [...new Set(results.filter(r => r.response).map(r => r.response))];
        const errors = [...new Set(results.filter(r => r.errors).map(r => r.errors))];
        let timestamp = (as3Task.declaration && as3Task.declaration.controls) ? as3Task.declaration.controls.archiveTimestamp : '';
        if ([...changes].join() === 'in progress') {
            timestamp = new Date().toISOString();
        }

        task.timestamp = timestamp;
        task.code = (as3Task.results && as3Task.results[0]) ? as3Task.results[0].code : 0;
        task.message = [...changes, ...responses, ...errors].join('\n');

        return task;
    }
}

/** Class representing an AS3 Driver. */
class AS3Driver {
    constructor(options) {
        options = options || {};
        options.bigipInfo = options.bigipInfo || {
            host: options.host || 'http://localhost:8100',
            username: options.bigipUser || 'admin',
            password: options.bigipPassword || ''
        };
        this.logger = options.logger || {
            error: console.error, /* eslint-disable-line no-console */
            log: console.log, /* eslint-disable-line no-console */
            info: console.log, /* eslint-disable-line no-console */
            fine: console.log /* eslint-disable-line no-console */
        };
        const endPointUrl = options.endPointUrl || `${options.bigipInfo.host}/mgmt/shared/appsvcs`;
        if (typeof options.strictCerts === 'undefined') {
            options.strictCerts = true;
        }
        if (typeof options.bigipInfo.strictCerts === 'undefined') {
            options.bigipInfo.strictCerts = options.strictCerts;
        }
        if (typeof options.useDeclarationCache === 'undefined') {
            options.useDeclarationCache = true;
        }

        this._tracer = options.tracer;

        this._nextId = 0;
        this._static_id = '';
        this._task_ids = {};
        this._declStub = {
            class: 'ADC',
            schemaVersion: '3.0.0'
        };
        this._tsMixin = null;
        this._tsOptions = {};
        this.userAgent = options.userAgent;

        this._opInProgress = false;

        const axiosConfig = {
            baseURL: endPointUrl,
            maxBodyLength: 'Infinity',
            httpAgent: new http.Agent({
                keepAlive: false
            }),
            httpsAgent: new https.Agent({
                rejectUnauthorized: options.bigipInfo.strictCerts,
                keepAlive: false
            })
        };
        if (options.apiToken) {
            axiosConfig.headers = {
                Authorization: `Bearer ${options.apiToken}`
            };
        } else if (options.bigipInfo.username && !options.getAuthToken) {
            axiosConfig.auth = {
                username: options.bigipInfo.username,
                password: options.bigipInfo.password
            };
        }
        this._endpoint = axios.create(axiosConfig);
        axiosRetry(this._endpoint, {
            retries: process.env.FAST_MAX_RETRIES_COUNT || 15,
            retryDelay: axiosRetry.exponentialDelay,
            retryCondition: (error) => {
                if (error.response.status > 499 && error.request.method === 'POST') {
                    return true;
                }
                return false;
            },
            onRetry: (retryCount, error) => {
                this.logger.info('Retrying HTTP request for AS3 Driver');
                this.logger.info(`Error: ${error}`);
                this.logger.info(`Retry Count: ${retryCount}`);
            }
        });
        this._getAuthToken = options.getAuthToken;

        this._useDeclCache = options.useDeclarationCache;
        this._declCache = null;

        if (typeof options.useOptimisticLock === 'undefined') {
            options.useOptimisticLock = true;
        }
        this._useOptimisticLock = options.useOptimisticLock;
        this._taskIdMap = {};
        this._pendingTasks = [];
        this._erroredTasks = [];
        this._pendingTaskPollRate = process.env.FAST_PENDING_TASK_POLL_RATE_IN_MS || 1000; // in ms
        this._pendingTasksTimeout = setTimeout(
            () => this._handlePendingTasks(),
            this._pendingTaskPollRate
        );
        this._pendingTasksTimeout.unref();
    }

    setTracer(tracer) {
        this._tracer = tracer;
    }

    /**
     * start OpLock for AS3 request
     * @param {Object} options - optional extra context
     * @returns {Promise}
     */
    _getOpLock(options) {
        const start = Date.now();
        const timeout = process.env.FAST_OP_LOCK_TIMEOUT_IN_MS || 50000;
        const self = this;
        const promise = new Promise((resolve, reject) => {
            function checkVal() {
                if (!self._opInProgress) {
                    self._traceEvent(options, 'OpLock acquired');
                    self._opInProgress = true;
                    resolve();
                } else if (Date.now() - start >= timeout) {
                    reject(new Error(
                        `Failed to aqcuire operation lock in ${timeout}ms`
                    ));
                } else {
                    self._traceEvent(options, 'OpLock is not available');
                    setTimeout(checkVal, 50);
                }
            }
            checkVal();
        });
        return this._tracePromise(
            options,
            'acquire op lock',
            promise
        );
    }

    /**
     * release OpLock after AS3 request
     * @param {Object} options - optional extra context
     * @returns {Promise}
     */
    _releaseOpLock(options) {
        return Promise.resolve()
            .then(() => {
                this._traceEvent(options, 'OpLock released');
                this._opInProgress = false;
            });
    }

    /**
     * load Telemetry Streaming config from yaml
     * @returns {Promise}
     */
    loadMixins() {
        return Promise.resolve()
            .then(() => {
                const tmplData = fs.readFileSync(path.join(__dirname, 'tscommon.yaml'), 'utf8');
                return fast.Template.loadYaml(tmplData);
            })
            .then((tmpl) => {
                this._tsMixin = tmpl;
            });
    }

    /**
     * set auth header with specified value
     * @param {string} authString - header key/val for authorization
     */
    setAuthHeader(authString) {
        if (authString.match(' ')) {
            this._endpoint.defaults.headers.common.Authorization = authString;
        } else {
            this._endpoint.defaults.headers.common['X-F5-AUTH-TOKEN'] = authString;
        }
    }

    /**
     * update auth header with token
     * @returns {Promise}
     */
    _updateAuthHeader() {
        if (!this._getAuthToken) {
            return Promise.resolve();
        }
        return this._getAuthToken()
            .catch(e => Promise.reject(new Error(`AS3Driver failed to authenticate: ${e.message}`)))
            .then(token => this.setAuthHeader(`Bearer ${token}`));
    }

    /**
     * get Info from AS3
     * @returns {Promise}
     */
    getInfo(options) {
        const infoUrl = '/info';
        return Promise.resolve()
            .then(() => this._tracePromise(
                options,
                'update auth header',
                this._updateAuthHeader()
            ))
            .then(() => this._tracePromise(
                options,
                `GET to ${infoUrl}`,
                this._endpoint.get('/info', {
                    validateStatus: () => true // ignore failure status codes
                })
            ))
            .catch(e => this._handleAS3Error('GET', e, 'info'));
    }

    /**
     * get Telemetry Streaming Settings
     * @returns {Promise}
     */
    getSettings() {
        if (!this._tsMixin) {
            return Promise.resolve({});
        }
        return Promise.resolve(Object.assign(
            {},
            this._tsMixin.getCombinedParameters(this._tsOptions)
        ));
    }

    /**
     * GET existing FAST Global Settings from device
     * @param {Object} options - optional extra context
     * @returns {Promise}
     */
    _getSettingsDecl(options) {
        const combDecl = Object.assign({}, this._declStub);
        combDecl.Common = {
            class: 'Tenant',
            Shared: {
                class: 'Application',
                template: 'shared'
            }
        };

        if (!this._tsMixin) {
            return Promise.resolve(combDecl);
        }
        const settingsDecl = (!this._tsMixin) ? {} : JSON.parse(this._tsMixin.render(this._tsOptions));

        return Promise.resolve()
            .then(() => this._getDecl(options))
            .then((decl) => {
                if (decl.Common && decl.Common.Shared) {
                    Object.assign(combDecl.Common.Shared, decl.Common.Shared);
                }

                if (settingsDecl.Common && settingsDecl.Common.Shared) {
                    Object.assign(combDecl.Common.Shared, settingsDecl.Common.Shared);
                }

                if (Object.keys(combDecl.Common.Shared).length <= 2) { // ['class', 'template']
                    delete combDecl.Common.Shared;
                }

                const oldApp = (decl.Common && decl.Common.Shared) ? decl.Common.Shared : {};
                const newApp = (combDecl.Common && combDecl.Common.Shared) ? combDecl.Common.Shared : {};
                if (JSON.stringify(oldApp) === JSON.stringify(newApp)) {
                    // No need to update again, return null to signal this
                    return null;
                }

                return combDecl;
            });
    }

    /**
     * set FAST Global Settings
     * @param {Object} settings - FAST Global Settings configuration
     * @returns {Promise}
     */
    setSettings(settings) {
        if (typeof settings.disableDeclarationCache !== 'undefined') {
            this._useDeclCache = !settings.disableDeclarationCache;
        }

        if (!this._tsMixin) {
            return Promise.resolve();
        }

        Object.keys(this._tsMixin.getParametersSchema().properties).forEach((prop) => {
            if (prop in settings && settings[prop] !== '') {
                this._tsOptions[prop] = settings[prop];
            }
        });

        return Promise.resolve();
    }

    /**
     * Update settings based on provisioned modules
     * @param {Array} provisionedModules - array of strings representing currently provisioned modules
     * @param {Object} options - optional extra context
     * @returns {Promise}
     */
    updateProvisionInfo(provisionedModules, options) {
        const provisionSettings = {
            enable_telemetry: provisionedModules.includes('ts'),
            log_afm: (
                provisionedModules.includes('ts')
                && provisionedModules.includes('afm')
            ),
            log_asm: (
                provisionedModules.includes('ts')
                && provisionedModules.includes('asm')
            )
        };

        return this.setSettings(provisionSettings)
            .then(() => this._getSettingsDecl(options))
            .then((settingsDecl) => {
                this.logger.info('AS3 Driver settingsDecl', util.inspect(settingsDecl));
                if (!settingsDecl) {
                    this.logger.info('AS3 Driver settingsDecl was not');
                    return Promise.resolve();
                }

                return this._postDecl(settingsDecl, 'Common', Object.assign({}, options, { async: false }));
            });
    }

    /**
     * reset AS3 cache
     * @param {Object} options - optional extra context
     * @returns {Promise}
     */
    invalidateCache(options) {
        this._traceEvent(options, 'decl cache invalidated');
        return Promise.resolve()
            .then(() => {
                this._declCache = null;
            });
    }

    /**
     * get Settings Schema
     * @returns {Object}
     */
    getSettingsSchema() {
        if (!this._tsMixin) {
            return {};
        }

        const tsOptSchema = this._tsMixin.getParametersSchema();
        return fast.guiUtils.modSchemaForJSONEditor(tsOptSchema);
    }

    /**
     * get keys of specified Class from Declaration
     * @param {Object} obj - Declaration
     * @param {string} className - name of Class to get keys from
     * @returns {Object}
     */
    _getKeysByClass(obj, className) {
        return Object.keys(obj).filter(key => obj[key].class === className);
    }

    /**
     * get Tenant keys from Declaration
     * @param {Object} declaration
     * @returns {Object}
     */
    _getDeclTenants(declaration) {
        return this._getKeysByClass(declaration, 'Tenant');
    }

    /**
     * get Application keys from Declaration
     * @param {Object} declaration
     * @param {boolean} onlyManaged - if true, only return managed Application keys
     * @returns {Promise}
     */
    _getDeclApps(declaration, onlyManaged) {
        const apps = [];
        this._getDeclTenants(declaration).forEach((tenant) => {
            this._getKeysByClass(declaration[tenant], 'Application').forEach((app) => {
                const appDef = declaration[tenant][app];
                if (!onlyManaged || (appDef.constants && appDef.constants[AS3DriverConstantsKey])) {
                    apps.push([tenant, app]);
                }
            });
        });
        return apps;
    }

    /**
     * create UUID for Declaration
     * @param {string} tenantName - name of Tenant
     * @param {string} appName - name of Application
     * @param {string} operation - action being performed
     * @returns {string}
     */
    _createUuid(tenantName, appName, operation) {
        operation = operation || 'unknown';
        const id = this._nextId;
        this._nextId += 1;
        return this._static_id || `${AS3DriverConstantsKey}%${operation}%${tenantName}%${appName}%${id}`;
    }

    /**
     * stitch new Application Declaration into existing
     * @param {Object} declaration - Declaration for existing config
     * @param {Object} appDef - new Application Declaration
     * @returns {Promise}
     */
    _stitchDecl(declaration, appDef) {
        const [tenantName, appName] = this._getDeclApps(appDef)[0];
        if (!declaration[tenantName]) {
            declaration[tenantName] = {
                class: 'Tenant'
            };
        }
        if ('defaultRouteDomain' in appDef[tenantName]) {
            declaration[tenantName].defaultRouteDomain = appDef[tenantName].defaultRouteDomain;
        }
        const operation = declaration[tenantName][appName] ? 'update' : 'create';
        declaration[tenantName][appName] = appDef[tenantName][appName];

        declaration.id = this._createUuid(tenantName, appName, operation);
        return declaration;
    }

    /**
     * GET AS3 Declaration for existing config
     * @param {Object} options - optional extra context
     * @returns {Promise}
     */
    _getDecl(options) {
        if (this._declCache) {
            return Promise.resolve(JSON.parse(JSON.stringify(this._declCache)));
        }

        const getUrl = `/declare${this._useOptimisticLock ? '?showHash=true' : ''}`;

        return Promise.resolve()
            .then(() => this._tracePromise(
                options,
                'update auth header',
                this._updateAuthHeader()
            ))
            .then(() => this._tracePromise(
                options,
                `GET to ${getUrl}`,
                this._endpoint.get(getUrl)
            ))
            .catch((e) => {
                if (!e.response) {
                    return Promise.reject(e);
                }

                return this._tracePromise(
                    options,
                    `Retry GET to ${getUrl}`,
                    this._endpoint.get(getUrl)
                );
            })
            .then(res => res.data.declaration || res.data)
            .then((decl) => {
                if (Object.keys(decl).length === 0) {
                    decl = Object.assign({}, this._declStub);
                }
                if (decl.Common && decl.Common.optimisticLockKey) {
                    delete decl.Common.optimisticLockKey;
                }
                if (this._useDeclCache) {
                    this._traceEvent(options, 'decl cache updated');
                    this._declCache = JSON.parse(JSON.stringify(decl));
                } else {
                    this._traceEvent(options, 'declaration cache disabled, clearing cache');
                    this._declCache = null;
                }
                return decl;
            })
            .catch(e => this._handleAS3Error('GET', e));
    }

    /**
     * GET AS3 Declaration w/o OpLock, hash, error handling, perfTracing or filtering
     * @returns {Promise}
     */
    getRawDeclaration() {
        return this._updateAuthHeader()
            .then(() => this._endpoint.get('/declare'));
    }

    /**
     * handle error in response from AS3
     * @param {string} method - HTTP method
     * @param {Object} err - error from AS3
     * @param {string} resource - request's endpoint type
     * @returns {Promise}
     */
    _handleAS3Error(method, err, resource) {
        resource = resource || 'declaration';

        let msg = err.message;
        if (err.response) {
            const rspData = err.response.data;
            msg = `${msg}\n${JSON.stringify(rspData.message, null, 2)}`;
            if (rspData.errors) {
                msg = `${msg}\nerrors:\n${JSON.stringify(rspData.errors, null, 2)}`;
            }
        }

        const error = new Error(`AS3 Driver failed to ${method} ${resource}: ${msg}`);
        error.response = err.response;
        return Promise.reject(error);
    }

    /**
     * filters declaration by tenant
     * @param {string} decl - full declaration
     * @param {Object} tenants - tenants
     * @returns {Object}
     */
    _filterDeclByTenant(decl, tenants) {
        const newDeclaration = {};
        if (!Array.isArray(tenants)) {
            tenants = tenants.replace('/', '').split(',');
        }
        Object.entries(decl).forEach(([key, value]) => {
            const declClass = value.class;
            if (declClass !== 'Tenant' || tenants.includes(key)) {
                newDeclaration[key] = decl[key];
            }
        });
        return newDeclaration;
    }

    /**
     * POST Declaration to AS3
     * @param {Object} decl - Declaration
     * @param {string[]} tenants - Tenants to send Declaration to
     * @param {Object} options - optional extra context
     * @returns {Promise}
     */
    _postDecl(decl, tenants, options) {
        tenants = tenants || [];
        if (Array.isArray(tenants)) {
            if (tenants.length === 0) {
                tenants = '';
            } else {
                tenants = Array.from(new Set(tenants));
                tenants = `/${tenants.join(',')}`;
            }
        } else {
            tenants = `/${tenants}`;
        }

        if (this.userAgent) {
            decl.controls = {
                class: 'Controls',
                userAgent: this.userAgent
            };
        }
        const asyncOption = options && options.async !== undefined ? options.async : true;
        const postUrl = `/declare${tenants}?async=${asyncOption}`;
        const declarationByTenant = this._filterDeclByTenant(decl, tenants);
        this.invalidateCache(options);
        return Promise.resolve()
            .then(() => this._tracePromise(
                options,
                'update auth header',
                this._updateAuthHeader()
            ))
            .then(() => this._tracePromise(
                options,
                `POST to ${postUrl}`,
                this._endpoint.post(postUrl, declarationByTenant)
            ))
            .then((result) => {
                result.body = result.data;
                this._task_ids[result.body.id] = declarationByTenant.id;
                this.invalidateCache(options);
                return result;
            })
            .then((result) => {
                if (asyncOption && result.status === 200) {
                    // We should never get a 200 back from the async API
                    return Promise.reject(new Error(
                        'AS3 Driver received a 200 response back from the async API (expected 202)'
                    ));
                }

                return result;
            })
            .catch(e => this._handleAS3Error('POST', e));
    }

    /**
     * get Tenant and Application in supplied Declaration
     * @param {Object} decl - Declaration
     * @returns {Promise[]}
     */
    getTenantAndAppFromDecl(decl) {
        decl = decl.declaration || decl;
        const tenantList = this._getDeclTenants(decl);
        if (tenantList.length === 0) {
            return Promise.reject(new Error('Did not find a tenant class in the application declaration'));
        }
        if (tenantList.length > 1) {
            return Promise.reject(new Error('Only one tenant class is supported for application declarations'));
        }
        const appList = this._getDeclApps(decl);
        if (appList.length === 0) {
            return Promise.reject(new Error('Did not find an application class in the application declaration'));
        }
        if (appList.length > 1) {
            return Promise.reject(new Error('Only one application class is supported for application declaration'));
        }
        return Promise.resolve(appList[0]);
    }

    /**
     * prepare Application's Definition before create
     * @param {Object} appDef - Application definition
     * @param {Object} metaData - Application metadata
     * @returns {Promise}
     */
    _prepareAppDef(appDef, metaData) {
        appDef = JSON.parse(JSON.stringify(appDef)); // copy appDef to avoid modifying it
        appDef = appDef.declaration || appDef;
        metaData = metaData || {};

        if (metaData.class) {
            return Promise.reject(new Error('metaData cannot contain the class key'));
        }

        return Promise.resolve()
            .then(() => this.getTenantAndAppFromDecl(appDef))
            .then(([tenantName, appName]) => {
                if (tenantName === 'Common') {
                    return Promise.reject(new Error('FAST applications cannot modify the /Common tenant'));
                }

                // Add constants
                if (!appDef[tenantName][appName].constants) {
                    appDef[tenantName][appName].constants = {
                        class: 'Constants'
                    };
                }
                Object.assign(appDef[tenantName][appName].constants, {
                    [AS3DriverConstantsKey]: metaData
                });
                return Promise.resolve(appDef);
            });
    }

    /**
     * add Task to queue
     * @param {Object} task
     * @param {Object} options - optional extra context
     * @returns {Promise}
     */
    _enqueueTask(task, options) {
        this._pendingTasks.push(task);

        if (this._pendingTasks.length === 1) {
            // Nothing else pending, no need to wait
            task.message = 'in progress';
            return Promise.resolve(null);
        }

        // Task will not get an AS3-based ID, give it one
        this._traceEvent(options, 'pending task enqueued');
        task.id = uuid.v4();
        return Promise.resolve({
            status: 202,
            data: { id: task.id },
            body: { id: task.id }
        });
    }

    /**
     * handle next Pending Task in queue
     * @returns {Promise}
     */
    _handlePendingTasks() {
        return Promise.resolve()
            .then(() => (this._pendingTasks.length === 0 ? Promise.resolve() : this.getTasks()))
            .then(() => this._getOpLock())
            .then(() => {
                if (this._pendingTasks.length === 0) {
                    return Promise.resolve();
                }

                const task = this._pendingTasks[0];
                if (task.id === null) {
                    // Hit a bug affecting some versions of AS3. This task will never complete,
                    // so just drop it. AS3 will still let us submit new tasks in this case.
                    this._pendingTasks.shift();
                    return Promise.resolve();
                }

                if (task.message === 'in progress') {
                    // Still waiting leave the task on the queue
                    return Promise.resolve();
                }

                if (task.message !== 'pending') {
                    // This task is done, drop it
                    this._pendingTasks.shift();
                    return Promise.resolve();
                }

                // The next task is pending, so start it
                if (task.operation === 'create') {
                    return this._createApplications(task)
                        .catch((e) => {
                            task.message = 'error';
                            task.code = e ? e.response.status : 500;
                            this._erroredTasks.push(task);
                            return Promise.reject(e);
                        });
                }
                if (task.operation === 'delete') {
                    return this._deleteApplications(task)
                        .catch((e) => {
                            task.message = 'error';
                            task.code = e ? e.response.status : 500;
                            this._erroredTasks.push(task);
                            return Promise.reject(e);
                        });
                }
                return Promise.reject(new Error(
                    `AS3 driver found a pending task with an unknown operation: ${task.operation}`
                ));
            })
            .catch((e) => {
                this.logger.error(`FAST AS3 Driver Error while handling task: ${e.message}`);
            })
            .finally(() => Promise.resolve()
                .then(() => this._releaseOpLock())
                .then(() => {
                    this._pendingTasksTimeout = setTimeout(
                        () => this._handlePendingTasks(),
                        this._pendingTaskPollRate
                    );
                    this._pendingTasksTimeout.unref();
                }));
    }

    /**
     * create new FAST Application
     * @param {Object} appDef - Application definition
     * @param {Object} metaData - Application metadata
     * @param {Object} options - optional config object
     * @returns {Promise}
     */
    createApplication(appDef, metaData, options) {
        return Promise.resolve()
            .then(() => this.createApplications([{ appDef, metaData }], options));
    }

    /**
     * prepare Application creation Declaration & response before & after POST
     * @param {Object} task
     * @param {Object} options - optional extra context
     * @returns {Promise}
     */
    _createApplications(task, options) {
        const appDefs = task.taskData;
        const tenants = [];

        return Promise.resolve()
            // Ensure we are not using a stale declaration
            .then(() => this.invalidateCache(options))
            .then(() => this._getDecl(options))
            .then((decl) => {
                appDefs.forEach((appDef) => {
                    tenants.push(this._getDeclTenants(appDef)[0]);
                });
                return Promise.all(
                    appDefs.map(appDef => this._stitchDecl(decl, appDef))
                );
            })
            .then(declList => declList[0])
            .then(decl => this._postDecl(decl, tenants, options))
            .then((result) => {
                const as3id = result.data.id;
                if (!task.id) {
                    task.id = as3id;
                } else {
                    this._taskIdMap[as3id] = task.id;
                }

                return result;
            });
    }

    /**
     * start and end Application creation, handling result
     * @param {Object[]} appsData - array of Application data: def and meta
     * @param {Object} options - optional config object
     * @returns {Promise}
     */
    createApplications(appsData, options) {
        return Promise.resolve()
            .then(() => this._getOpLock(options))
            .then(() => Promise.all(appsData.map(data => this._prepareAppDef(data.appDef, data.metaData))))
            .then((appDefs) => {
                const task = new Task({
                    operation: 'create',
                    taskData: appDefs
                });
                return Promise.resolve()
                    .then(() => this.getTenantAndAppFromDecl(appDefs[0]))
                    .then(([tenant, application]) => {
                        task.tenant = tenant;
                        task.application = application;
                    })
                    .then(() => this._enqueueTask(task, options))
                    .then((result) => {
                        if (result) {
                            return Promise.resolve(result);
                        }
                        // We did not enqueue, send directly
                        this._traceEvent(options, 'create task submited to AS3 directly');
                        return this._createApplications(task, options);
                    })
                    .catch((e) => {
                        task.message = 'error';
                        task.code = e ? e.response.status : 500;
                        this._erroredTasks.push(task);
                        return Promise.reject(e);
                    });
            })
            .finally(() => this._releaseOpLock(options));
    }

    /**
     * validate supplied Declaration and Tenant/Application within it
     * @param {Object} decl - Declaration
     * @param {Object} tenant - name of Tenant
     * @param {Object} app - name of Application
     * @returns {Promise}
     */
    _validateTenantApp(decl, tenant, app) {
        if (!decl[tenant]) {
            return Promise.reject(new Error(`no tenant found for tenant name: ${tenant}`));
        }
        if (!decl[tenant][app]) {
            return Promise.reject(new Error(`could not find application ${tenant}/${app}`));
        }
        if (!decl[tenant][app].constants || !decl[tenant][app].constants[AS3DriverConstantsKey]) {
            return Promise.reject(new Error(`application is not managed by FAST: ${tenant}/${app}`));
        }
        return Promise.resolve(decl);
    }

    /**
     * DELETE FAST Application
     * @param {string} tenant - name of Tenant containing the Application
     * @param {string} app - name of Application to be deleted
     * @param {Object} options - optional extra context
     * @returns {Promise}
     */
    deleteApplication(tenant, app, options) {
        return Promise.resolve()
            .then(() => this.deleteApplications([[tenant, app]], options));
    }

    /**
     * DELETE Applications from device
     * @param {Object} task
     * @param {Object} options - optional extra context
     * @returns {Promise}
     */
    _deleteApplications(task, options) {
        let appNames = task.taskData;
        const tenants = [];
        const doDeleteAll = !appNames || appNames.length === 0;
        return Promise.resolve()
            .then(() => {
                // Ensure we are not using a stale declaration
                this.invalidateCache(options);
            })
            .then(() => this._getDecl(options))
            .then((decl) => {
                if (!doDeleteAll) {
                    return Promise.resolve()
                        .then(() => Promise.all(
                            appNames.map(
                                ([tenant, app]) => this._validateTenantApp(decl, tenant, app)
                            )
                        ))
                        .then(() => decl);
                }
                return Promise.resolve()
                    .then(() => this.listApplicationNames(options))
                    .then((apps) => {
                        appNames = apps;
                    })
                    .then(() => decl);
            })
            .then((decl) => {
                appNames.forEach(([tenant, app]) => {
                    tenants.push(tenant);
                    delete decl[tenant][app];
                });
                if (appNames.length === 1) {
                    decl.id = this._createUuid(appNames[0][0], appNames[0][1], 'delete');
                } else {
                    decl.id = this._createUuid('', '', (doDeleteAll) ? 'delete-all' : 'delete');
                }
                return Promise.resolve(decl);
            })
            .then(decl => this._postDecl(decl, tenants, options))
            .then((result) => {
                const as3id = result.data.id;
                if (!task.id) {
                    task.id = as3id;
                } else {
                    this._taskIdMap[as3id] = task.id;
                }
                return result;
            });
    }

    /**
     * DELETE multiple Applications
     * @param {Object[]} appNames - multi-dimensional array of Tenant and Application name
     * @param {Object} options - optional extra context
     * @returns {Promise}
     */
    deleteApplications(appNames, options) {
        return Promise.resolve()
            .then(() => this._getOpLock(options))
            .then(() => {
                const task = new Task({
                    operation: 'delete',
                    taskData: appNames
                });

                return Promise.resolve()
                    .then(() => this._enqueueTask(task, options))
                    .then((result) => {
                        if (result) {
                            return Promise.resolve(result);
                        }
                        // We did not enqueue, send directly
                        this._traceEvent(options, 'delete task submited to AS3 directly');
                        return this._deleteApplications(task, options);
                    });
            })
            .finally(() => this._releaseOpLock(options));
    }

    /**
     * GET existing Application Names from AS3 Declaration
     * @param {Object} options - optional extra context
     * @returns {Promise}
     */
    listApplicationNames(options) {
        return this._getDecl(options)
            .then(decl => this._getDeclApps(decl, true));
    }

    /**
     * GET existing Applications' Declaration
     * @param {Object} options - optional extra context
     * @returns {Promise}
     */
    listApplications(options) {
        return this._getDecl(options)
            .then((decl) => {
                const appList = this._getDeclApps(decl, true);
                return appList.map(([tenantName, appName]) => _appFromDecl(decl, tenantName, appName));
            });
    }

    /**
     * GET existing Application data from device
     * @param {string} tenant - name of Tenant
     * @param {string} app - name of Application
     * @param {Object} options - optional extra context
     * @returns {Promise}
     */
    getApplication(tenant, app, options) {
        return this._getDecl(options)
            .then(decl => this._validateTenantApp(decl, tenant, app))
            .then(decl => _appFromDecl(decl, tenant, app));
    }

    /**
     * get list of Tasks with updated status
     * @param {Object} options - optional extra context
     * @returns {Object[]}
     */
    getTasks(options) {
        const itemMatch = item => (
            (item.declaration.id && item.declaration.id.startsWith(AS3DriverConstantsKey))
            || this._task_ids[item.id]
        );
        const as3ToFAST = (item) => {
            item.declaration.id = item.declaration.id || this._task_ids[item.id];
            const task = Task.fromAS3(item).toJSON();
            task.id = this._taskIdMap[task.id] || task.id;
            return task;
        };
        const taskUrl = '/task';
        return Promise.resolve()
            .then(() => this._tracePromise(
                options,
                'update auth header',
                this._updateAuthHeader()
            ))
            .then(() => this._getOpLock(options))
            .then(() => this._tracePromise(
                options,
                `GET to ${taskUrl}`,
                this._endpoint.get('/task')
            ))
            .catch(e => this._handleAS3Error('GET', e, 'tasks'))
            .then((result) => {
                const items = result.data.items || result.data;
                return items.filter(itemMatch).map(as3ToFAST);
            })
            .then((as3Tasks) => {
                const pendingTasks = [];
                this._pendingTasks.forEach((pendingTask) => {
                    const as3Task = as3Tasks.find(x => x.id === pendingTask.id);
                    if (!as3Task) {
                        // No AS3 task, we're still pending
                        pendingTasks.push(pendingTask.toJSON());
                        return;
                    }

                    // Our job was submitted, update the pending task
                    pendingTask.code = as3Task.code;
                    pendingTask.message = as3Task.message;
                });
                return [...pendingTasks, ...as3Tasks, ...this._erroredTasks];
            })
            .finally(() => this._releaseOpLock(options));
    }

    /**
     * Log Jaeger Performance Tracing event
     * @param {Object} opts - optional extra context
     * @param {string} evt - description of event
     */
    _traceEvent(opts, evt) {
        const reqid = opts && (opts.reqid || opts.requestId);
        if (this._tracer && reqid) {
            this._tracer.logEvent(reqid, evt);
        }
    }

    /**
     * record child span for Jaeger Performance Tracing
     * @param {Object} opts - optional extra context
     * @param {string} msg - description of promise
     * @param {Promise} promise - promise being traced with Jaeger
     * @returns {Promise}
     */
    _tracePromise(opts, msg, promise) {
        const reqid = opts && (opts.reqid || opts.requestId);
        if (this._tracer && reqid) {
            return this._tracer.recordChildSpan(
                reqid,
                `driver: ${msg}`,
                promise
            );
        }

        return promise;
    }
}

module.exports = {
    AS3Driver,
    AS3DriverConstantsKey
};
