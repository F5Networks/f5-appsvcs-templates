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
        this.id = options.id || uuid.v4();
        this.taskData = options.taskData || null;
        this.code = options.code || 202;
        this.message = options.message || 'pending';
        this.name = options.name || '';
        this.parameters = options.parameters || {};
        this.tenant = options.tenant || '';
        this.application = options.application || '';
        this.operation = options.operation || 'unknown';
        this.timestamp = options.timestamp || new Date().toISOString();
        this.host = options.host || 'localhost';
        this.as3Id = options.as3Id || null;
        this.batchStatus = 'single'; // single, parent, batched, errored
        this.errors = [];
    }

    /**
     * return Task as json
     * @returns {Object}
     */
    toJSON() {
        const jsonobj = {
            id: this.id,
            code: this.code,
            message: this.message,
            name: this.name,
            parameters: this.parameters,
            tenant: this.tenant,
            application: this.application,
            operation: this.operation,
            timestamp: this.timestamp,
            host: this.host,
            _as3Id: this.as3Id,
            _batchStatus: this.batchStatus
        };

        if (this.errors.length > 0) {
            jsonobj.errors = this.errors;
        }

        return jsonobj;
    }

    matchesAS3Task(as3Task) {
        const as3Id = this.as3Id || this.id;
        return as3Id === as3Task.id;
    }

    /**
     * update task with information from AS3
     */
    updateFromAS3(as3Task) {
        const decl = as3Task.declaration;
        const results = (as3Task.results || []).filter(
            result => (
                result.errors
                || result.tenant === this.tenant
                || result.tenant === ''
                || !result.tenant
                || this.tenant === ''
            )
        );

        if (this.message === 'in progress') {
            this.timestamp = new Date().toISOString();
        } else if (decl && decl.controls) {
            this.timestamp = decl.controls.archiveTimestamp;
        }

        if (results.length > 0) {
            this.code = results[0].code;
            this.message = [
                ...results.filter(r => r.message).map(r => r.message),
                ...results.filter(r => r.response).map(r => r.response)
            ].join('\n');

            this.errors = results.filter(r => r.errors).map(r => r.errors).flat();

            const host = results[0].host;
            if (host && host !== '') {
                this.host = host;
            }
        }
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

        this._declStub = {
            class: 'ADC',
            schemaVersion: '3.0.0'
        };
        this._tsMixin = null;
        this._tsOptions = {};
        this.userAgent = options.userAgent;
        this._pendingTasksMaxNumber = 0;
        this._enableTasksAutoBatch = true;
        this._opInProgress = false;

        this._taskOpMap = {
            create: this._createApplications.bind(this),
            delete: this._deleteApplications.bind(this),
            'delete-all': this._deleteApplications.bind(this)
        };

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
            retries: process.env.FAST_MAX_RETRIES_COUNT || 5,
            retryDelay: axiosRetry.exponentialDelay,
            retryCondition: (error) => {
                if (error.response && error.response.status > 499) {
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
        this._taskCache = null;
        this._taskCacheTime = null;

        if (typeof options.useOptimisticLock === 'undefined') {
            options.useOptimisticLock = true;
        }
        this._useOptimisticLock = options.useOptimisticLock;
        this._batchedTaskIdMap = {};
        this._pendingTasks = [];
        this._finishedTasks = [];
        this._pendingTaskPollRate = process.env.FAST_PENDING_TASK_POLL_RATE_IN_MS || 3000;
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

        if (typeof settings.pendingTasksMaxNumber !== 'undefined') {
            this._pendingTasksMaxNumber = settings.pendingTasksMaxNumber;
        }

        if (typeof settings.enableTasksAutoBatch !== 'undefined') {
            this._enableTasksAutoBatch = settings.enableTasksAutoBatch;
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
                if (!settingsDecl) {
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
                this._taskCache = null;
                this._taskCacheTime = null;
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
     * stitch new Application Declaration into existing
     * @param {Object} declaration - Declaration for existing config
     * @param {Object} appDef - new Application Declaration
     * @returns {Object}
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
        declaration[tenantName][appName] = appDef[tenantName][appName];

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

        const rspData = (err.response) ? err.response.data : undefined;
        const msg = (rspData) ? rspData.message : err.message;

        const error = new Error(`AS3 Driver failed to ${method} ${resource}: ${msg}`);
        error.response = err.response;
        const errors = (rspData) ? rspData.errors : undefined;
        if (errors) {
            error.errors = errors.map(e => ((typeof e === 'string') ? { summary: e } : e));
        }
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
        if (this._pendingTasksMaxNumber !== 0 && this._pendingTasks.length > this._pendingTasksMaxNumber) {
            const error = new Error('AS3 Driver reached the maximum number of allowed pending tasks');
            error.errors = [{
                summary: `Please use batching for deploying many applications at once or increase max number of pending tasks via settings endpoint. The current setting is ${this._pendingTasksMaxNumber}`
            }];
            error.response = {
                status: 503,
                data: {
                    message: error.message,
                    errors: error.errors
                }
            };
            return Promise.reject(error);
        }
        this._pendingTasks.push(task);

        if (this._pendingTasks.length === 1) {
            // Nothing else pending, no need to wait
            this._traceEvent(options, `${task.operation} task submited to AS3 directly`);
            return this._execTask(task, options);
        }

        this._traceEvent(options, 'pending task enqueued');
        return Promise.resolve({
            status: 202,
            data: { id: task.id },
            body: { id: task.id }
        });
    }

    /**
     * add Task to finished queue
     * @param {Object} task
     */
    _enqueueFinishedTask(tasks) {
        const maxTasks = process.env.FAST_MAX_FINISHED_TASKS || 250;
        tasks.forEach((task) => {
            this._finishedTasks.unshift(task);
            if (this._finishedTasks > maxTasks) {
                this._finishedTasks.length = maxTasks;
            }
        });
    }

    /**
     * execute task
     * @param {Object} task
     * @param {Object} additional context
     * @return {Promise}
     */
    _execTask(task, options) {
        const taskOpFunc = this._taskOpMap[task.operation];
        if (!taskOpFunc) {
            return Promise.reject(new Error(
                `AS3 driver attempted to execute a task with an unknown operation: ${task.operation}`
            ));
        }

        task.message = 'in progress';

        return Promise.resolve()
            .then(() => this.invalidateCache())
            .then(() => this._getDecl(options))
            .then(decl => taskOpFunc(task, decl, options))
            .then(([decl, tenants]) => this._postDecl(decl, tenants, options))
            .then((result) => {
                task.as3Id = result.data.id;
                if (this._batchedTaskIdMap[task.id]) {
                    this._batchedTaskIdMap[task.id].forEach((batchedTask) => {
                        batchedTask.as3Id = task.as3Id;
                    });
                }
                result.data.id = task.id;
                return result;
            })
            .catch((e) => {
                task.message = 'error';
                task.code = e && e.response ? e.response.status : 500;
                this._pendingTasks.shift();
                this._enqueueFinishedTask([task]);
                return Promise.reject(e);
            });
    }

    /**
     * handle next Pending Task in queue
     * @returns {Promise}
     */
    _handlePendingTasks() {
        let task;
        return Promise.resolve()
            .then(() => (this._pendingTasks.length === 0 ? Promise.resolve() : this.getTasks()))
            .then(() => {
                if (this._pendingTasks.length === 0) {
                    return Promise.resolve();
                }

                task = this._pendingTasks[0];
                if (task.id === null) {
                    // Hit a bug affecting some versions of AS3. This task will never complete,
                    // so just drop it. AS3 will still let us submit new tasks in this case.
                    this._pendingTasks.shift();
                    return Promise.resolve();
                }

                if (task.message.includes('in progress') > 0) {
                    // Still waiting leave the task on the queue
                    return Promise.resolve();
                }

                if (task.message !== 'pending') {
                    // This task is done, move it
                    const finishedTasks = [task].concat(this._batchedTaskIdMap[task.id] || []);
                    const finishedTaskIds = finishedTasks.map(x => x.id);
                    this._pendingTasks = this._pendingTasks.filter(x => !finishedTaskIds.includes(x.id));
                    this._enqueueFinishedTask(finishedTasks);
                    return this.invalidateCache();
                }
                // The next task is pending, so start it
                // If there are other tasks with the same operation, batch them together
                if (this._enableTasksAutoBatch && task.batchStatus === 'single') {
                    this._batchedTaskIdMap[task.id] = [];
                    const batchEnd = this._pendingTasks.findIndex(x => x.operation !== task.operation);
                    this._pendingTasks.slice(1, batchEnd).forEach((item) => {
                        task.taskData = task.taskData.concat(item.taskData);
                        this._batchedTaskIdMap[task.id].push(item);
                        item.batchStatus = 'batched';
                        task.batchStatus = 'parent';
                    });
                }
                return Promise.resolve()
                    .then(() => this._getOpLock())
                    .then(() => this._execTask(task))
                    .finally(() => this._releaseOpLock());
            })
            .catch((e) => {
                this.logger.error(`FAST AS3 Driver Error while handling task: ${e.message}`);
                if (task && task.batchStatus === 'parent') {
                    this._batchedTaskIdMap[task.id].forEach((batchedTask) => {
                        this._unbatchTask(batchedTask);
                    });
                    task.taskData = task.taskData.slice(1);
                    delete this._batchedTaskIdMap[task.id];
                }
            })
            .finally(() => Promise.resolve()
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
    _createApplications(task, decl) {
        const appDefs = task.taskData;
        const tenants = [];

        appDefs.forEach((appDef) => {
            tenants.push(this._getDeclTenants(appDef)[0]);
            this._stitchDecl(decl, appDef);
        });

        return Promise.resolve([decl, tenants]);
    }

    /**
     * start and end Application creation, handling result
     * @param {Object[]} appsData - array of Application data: def and meta
     * @param {Object} options - optional config object
     * @returns {Promise}
     */
    createApplications(appsData, options) {
        const task = new Task({
            operation: 'create'
        });
        return Promise.resolve()
            .then(() => this._getOpLock(options))
            .then(() => Promise.all(appsData.map(data => this._prepareAppDef(data.appDef, data.metaData))))
            .then((appDefs) => {
                task.taskData = appDefs;
                return Promise.resolve()
                    // TODO: Batch tasks only have info for the first app!
                    .then(() => this.getTenantAndAppFromDecl(appDefs[0]))
                    .then(([tenant, application]) => {
                        task.tenant = tenant;
                        task.application = application;
                        task.name = appsData[0].metaData.template;
                        task.parameters = appsData[0].metaData.view;
                    })
                    .then(() => this._enqueueTask(task, options));
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
    _deleteApplications(task, decl, options) {
        let appNames = task.taskData;
        const tenants = [];
        const doDeleteAll = !appNames || appNames.length === 0;
        return Promise.resolve()
            .then(() => {
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
            .then(() => {
                appNames.forEach(([tenant, app]) => {
                    tenants.push(tenant);
                    delete decl[tenant][app];
                });
                return Promise.resolve([decl, tenants]);
            });
    }

    /**
     * DELETE multiple Applications
     * @param {Object[]} appNames - multi-dimensional array of Tenant and Application name
     * @param {Object} options - optional extra context
     * @returns {Promise}
     */
    deleteApplications(appNames, options) {
        const task = new Task({
            operation: (!appNames || appNames.length === 0) ? 'delete-all' : 'delete',
            taskData: appNames
        });
        return Promise.resolve()
            .then(() => this._getOpLock(options))
            .then(() => this._enqueueTask(task, options))
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
     * GET existing Application's Declaration
     * @param {string} tenantName - name of Tenant
     * @param {string} appName - name of Application
     * @param {Object} options - optional extra context
     * @returns {Promise}
     */
    listApplication(tenant, app, options) {
        return this.getRawDeclaration(options)
            .then((resp) => {
                const data = {
                    class: 'Application',
                    constants: resp.data[tenant][app].constants,
                    _links: resp.data[tenant][app]._links
                };
                return data;
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
        return Promise.resolve()
            .then(() => this._tracePromise(
                options,
                'update auth header',
                this._updateAuthHeader()
            ))
            .then(() => this._getOpLock(options))
            .then(() => {
                if (this._pendingTasks.length === 0) {
                    return {
                        data: []
                    };
                }
                const taskCacheTimeout = process.env.FAST_TASK_CACHE_TIMEOUT || 1000;
                if (this._taskCache && (Date.now() - this._taskCacheTime) < taskCacheTimeout) {
                    return Promise.resolve(this._taskCache);
                }

                return this._tracePromise(
                    options,
                    'GET to /task',
                    this._endpoint.get('/task')
                )
                    .then((result) => {
                        this._taskCache = result;
                        this._taskCacheTime = Date.now();
                        return result;
                    });
            })
            .catch(e => this._handleAS3Error('GET', e, 'tasks'))
            .then(result => result.data.items || result.data)
            .then((as3Tasks) => {
                this._pendingTasks.forEach((pendingTask) => {
                    const as3Task = as3Tasks.find(x => pendingTask.matchesAS3Task(x));
                    if (as3Task) {
                        pendingTask.updateFromAS3(as3Task);
                    }
                    if (pendingTask.code > 399 && pendingTask.batchStatus === 'parent') {
                        pendingTask.message = 'pending';
                        pendingTask.code = null;
                        pendingTask.batchStatus = 'errored';
                        pendingTask.as3Id = null;
                        this._batchedTaskIdMap[pendingTask.id].forEach((batchedTask) => {
                            this._unbatchTask(batchedTask);
                        });
                        pendingTask.taskData = pendingTask.taskData[0];
                        delete this._batchedTaskIdMap[pendingTask.id];
                    }
                });
            })
            .then(() => [
                // Put newer tasks to the front of the array and output as JSON
                ...this._pendingTasks.map(t => t.toJSON()).reverse(),
                ...this._finishedTasks.map(t => t.toJSON())
            ])
            .finally(() => this._releaseOpLock(options));
    }

    /**
     * Log Jaeger Performance Tracing event
     * @param {Object} batchedTask - batchedTask
     */
    _unbatchTask(batchedTask) {
        this._pendingTasks.map((task) => {
            if (task.id === batchedTask.id) {
                task.message = 'pending';
                task.batchStatus = 'errored';
                task.as3Id = null;
            }
            return task;
        });
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
    AS3DriverConstantsKey,
    Task
};
