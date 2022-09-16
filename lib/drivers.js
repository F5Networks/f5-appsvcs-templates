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
const uuid = require('uuid');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');

const fast = require('@f5devcentral/f5-fast-core');

const { TraceTags } = require('@f5devcentral/atg-shared-utilities').tracer;

const AS3DriverConstantsKey = 'fast';

function _appFromDecl(declaration, tenant, app) {
    const as3App = declaration[tenant][app];
    const fastApp = (as3App.constants && as3App.constants[AS3DriverConstantsKey]) || {};
    return Object.assign({}, fastApp, {
        tenant,
        name: app
    });
}

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

class AS3Driver {
    constructor(options) {
        options = options || {};
        if (options.ctx) {
            options.ctx.span.log('creating_as3_driver');
        }
        options.bigipInfo = options.bigipInfo || {
            host: options.host || 'http://localhost:8100',
            username: options.bigipUser || 'admin',
            password: options.bigipPassword || ''
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
        this._pendingTaskPollRate = 1000; // in ms
        setTimeout((() => this._handlePendingTasks(options.ctx)), this._pendingTaskPollRate);
    }

    _getOpLock(span) {
        const start = Date.now();
        const timeout = 50000;
        const self = this;
        return new Promise((resolve, reject) => {
            function checkVal() {
                if (!self._opInProgress) {
                    self._opInProgress = true;
                    span.log('opLock_started');
                    resolve();
                } else if (Date.now() - start >= timeout) {
                    reject(new Error(
                        `Failed to aqcuire operation lock in ${timeout}ms`
                    ));
                } else {
                    setTimeout(checkVal, 50);
                }
            }
            checkVal();
        });
    }

    _releaseOpLock(span) {
        return Promise.resolve()
            .then(() => {
                this._opInProgress = false;
                span.log('opLock_finished');
            });
    }

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

    setAuthHeader(authString) {
        if (authString.match(' ')) {
            this._endpoint.defaults.headers.common.Authorization = authString;
        } else {
            this._endpoint.defaults.headers.common['X-F5-AUTH-TOKEN'] = authString;
        }
    }

    _updateAuthHeader() {
        if (!this._getAuthToken) {
            return Promise.resolve();
        }
        return this._getAuthToken()
            .catch(e => Promise.reject(new Error(`AS3Driver failed to authenticate: ${e.message}`)))
            .then(token => this.setAuthHeader(`Bearer ${token}`));
    }

    getInfo() {
        return this._updateAuthHeader()
            .then(() => this._endpoint.get('/info', {
                validateStatus: () => true // ignore failure status codes
            }))
            .catch(e => this._handleAS3Error('GET', e, 'info'));
    }

    getSettings() {
        if (!this._tsMixin) {
            return Promise.resolve({});
        }
        return Promise.resolve(Object.assign(
            {},
            this._tsMixin.getCombinedParameters({})
        ));
    }

    _getSettingsDecl(span, tsOptions) {
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

        const settingsDecl = (!this._tsMixin) ? {} : JSON.parse(this._tsMixin.render(tsOptions));

        return Promise.resolve()
            .then(() => this._getDecl(span))
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

                return combDecl;
            });
    }

    _calculateTsSettings(settings, provisionData) {
        const provisionedModules = provisionData.items.filter(x => x.level !== 'none').map(x => x.name);
        settings.enable_telemetry = provisionedModules.includes('ts');
        settings.log_afm = (
            provisionedModules.includes('ts')
            && provisionedModules.includes('afm')
        );
        settings.log_asm = (
            provisionedModules.includes('ts')
            && provisionedModules.includes('asm')
        );

        return settings;
    }

    setSettings(settings, provisionData, skipPost, ctx) {
        const span = (ctx) ? this._buildAndStartSpan('setSettings', ctx) : undefined;

        // Do not modify passed in settings
        settings = JSON.parse(JSON.stringify(settings));
        this._calculateTsSettings(settings, provisionData[0]);

        this._useDeclCache = !settings.disableDeclarationCache;

        if (!this._tsMixin || skipPost) {
            return Promise.resolve();
        }

        this.invalidateCache();
        return Promise.resolve()
            .then(() => this._getSettingsDecl(span, settings))
            .then(decl => this._postDecl(decl, 'Common'));
    }

    invalidateCache() {
        return Promise.resolve()
            .then(() => {
                this._declCache = null;
            });
    }

    getSettingsSchema() {
        if (!this._tsMixin) {
            return {};
        }

        const tsOptSchema = this._tsMixin.getParametersSchema();
        return fast.guiUtils.modSchemaForJSONEditor(tsOptSchema);
    }

    _getKeysByClass(obj, className) {
        return Object.keys(obj).filter(key => obj[key].class === className);
    }

    _getDeclTenants(declaration) {
        return this._getKeysByClass(declaration, 'Tenant');
    }

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

    _createUuid(tenantName, appName, operation) {
        operation = operation || 'unknown';
        const id = this._nextId;
        this._nextId += 1;
        return this._static_id || `${AS3DriverConstantsKey}%${operation}%${tenantName}%${appName}%${id}`;
    }

    _stitchDecl(declaration, appDef) {
        const [tenantName, appName] = this._getDeclApps(appDef)[0];
        if (!declaration[tenantName]) {
            declaration[tenantName] = {
                class: 'Tenant'
            };
        }
        const operation = declaration[tenantName][appName] ? 'update' : 'create';
        declaration[tenantName][appName] = appDef[tenantName][appName];

        declaration.id = this._createUuid(tenantName, appName, operation);
        return declaration;
    }

    _getDecl(span) {
        if (this._useDeclCache && this._declCache) {
            if (span) {
                span.log('get_decl_from_cache');
            }
            return Promise.resolve(JSON.parse(JSON.stringify(this._declCache)));
        }
        if (span) {
            span.log('get_decl_started');
        }

        const getUrl = `/declare${this._useOptimisticLock ? '?showHash=true' : ''}`;

        return this._updateAuthHeader()
            .then(() => this._endpoint.get(getUrl))
            .catch((e) => {
                if (!e.response) {
                    return Promise.reject(e);
                }

                return this._endpoint.get(getUrl);
            })
            .then(res => res.data.declaration || res.data)
            .then((decl) => {
                if (Object.keys(decl).length === 0) {
                    decl = Object.assign({}, this._declStub);
                }
                if (decl.Common && decl.Common.optimisticLockKey) {
                    delete decl.Common.optimisticLockKey;
                }
                this._declCache = this._useDeclCache ? JSON.parse(JSON.stringify(decl)) : null;
                if (span) {
                    span.log('get_decl_finished');
                }
                return decl;
            })
            .catch(e => this._handleAS3Error('GET', e));
    }

    getRawDeclaration() {
        return this._updateAuthHeader()
            .then(() => this._endpoint.get('/declare'));
    }

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

    _postDecl(decl, tenants) {
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

        this.invalidateCache();
        return this._updateAuthHeader()
            .then(() => this._endpoint.post(`/declare${tenants}?async=true`, decl))
            .then((result) => {
                result.body = result.data;
                this._task_ids[result.body.id] = decl.id;
                this.invalidateCache();
                return result;
            })
            .then((result) => {
                if (result.status === 200) {
                    // We should never get a 200 back from the async API
                    return Promise.reject(new Error(
                        'AS3 Driver received a 200 response back from the async API (expected 202)'
                    ));
                }

                return result;
            })
            .catch(e => this._handleAS3Error('POST', e));
    }

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

    _enqueueTask(task) {
        this._pendingTasks.push(task);

        if (this._pendingTasks.length === 1) {
            // Nothing else pending, no need to wait
            task.message = 'in progress';
            return Promise.resolve(null);
        }

        // Task will not get an AS3-based ID, give it one
        task.id = uuid.v4();
        return Promise.resolve({
            status: 202,
            data: { id: task.id },
            body: { id: task.id }
        });
    }

    _handlePendingTasks(ctx) {
        return Promise.resolve()
            .then(() => (this._pendingTasks.length === 0 ? Promise.resolve() : this.getTasks(ctx)))
            .then(() => this._getOpLock(ctx.span))
            .then(() => {
                if (this._pendingTasks.length === 0) {
                    return Promise.resolve();
                }

                const task = this._pendingTasks[0];
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
                    return this._createApplications(task, ctx.span)
                        .catch((e) => {
                            task.message = 'error';
                            task.code = e ? e.response.status : 500;
                            this._erroredTasks.push(task);
                            return Promise.reject(e);
                        });
                }
                if (task.operation === 'delete') {
                    return this._deleteApplications(task, ctx.span)
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
            .finally(() => Promise.resolve()
                .then(() => this._releaseOpLock(ctx.span))
                .then(() => setTimeout((() => this._handlePendingTasks(ctx)), this._pendingTaskPollRate)));
    }

    createApplication(appDef, metaData, ctx) {
        return Promise.resolve()
            .then(() => this.createApplications([{ appDef, metaData }], ctx));
    }

    _createApplications(task, span) {
        const appDefs = task.taskData;
        const tenants = [];

        return Promise.resolve()
            // Ensure we are not using a stale declaration
            .then(() => this.invalidateCache())
            .then(() => this._getDecl())
            .then((decl) => {
                appDefs.forEach((appDef) => {
                    tenants.push(this._getDeclTenants(appDef)[0]);
                });
                return Promise.all(
                    appDefs.map(appDef => this._stitchDecl(decl, appDef))
                );
            })
            .then(declList => declList[0])
            .then((decl) => {
                span.log('post_decl_started');
                return this._postDecl(decl, tenants);
            })
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

    createApplications(appsData, ctx) {
        const span = this._buildAndStartSpan('createApplications', ctx);
        return Promise.resolve()
            .then(() => this._getOpLock(span))
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
                    .then(() => this._enqueueTask(task))
                    .then((result) => {
                        if (result) {
                            return Promise.resolve(result);
                        }
                        // We did not enqueue, send directly
                        return this._createApplications(task, span);
                    })
                    .catch((e) => {
                        task.message = 'error';
                        task.code = e ? e.response.status : 500;
                        this._erroredTasks.push(task);
                        return Promise.reject(e);
                    });
            })
            .finally(() => this._releaseOpLock(span)
                .then(() => {
                    span.log('post_decl_finished');
                    span.finish();
                }));
    }

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

    deleteApplication(tenant, app, ctx) {
        return Promise.resolve()
            .then(() => this.deleteApplications([[tenant, app]], ctx));
    }

    _deleteApplications(task, span) {
        let appNames = task.taskData;
        const tenants = [];
        const doDeleteAll = !appNames || appNames.length === 0;
        return Promise.resolve()
            .then(() => {
                // Ensure we are not using a stale declaration
                this.invalidateCache();
            })
            .then(() => this._getDecl(span))
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
                    .then(() => this.listApplicationNames(span))
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
            .then((decl) => {
                span.log('post_decl_started');
                return this._postDecl(decl, tenants);
            })
            .then((res) => {
                span.log('post_decl_finished');
                return res;
            })
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

    deleteApplications(appNames, ctx) {
        const span = this._buildAndStartSpan('deleteApplications', ctx);
        return Promise.resolve()
            .then(() => this._getOpLock(span))
            .then(() => {
                const task = new Task({
                    operation: 'delete',
                    taskData: appNames
                });

                return Promise.resolve()
                    .then(() => this._enqueueTask(task))
                    .then((result) => {
                        if (result) {
                            return Promise.resolve(result);
                        }
                        // We did not enqueue, send directly
                        return this._deleteApplications(task, span);
                    });
            })
            .finally(() => {
                this._releaseOpLock(span);
                span.log('post_decl_finished');
                span.finish();
            });
    }

    listApplicationNames(ctx) {
        const span = (ctx.span) ? this._buildAndStartSpan('listApplicationNames', ctx) : ctx;

        return this._getDecl(span)
            .then((decl) => {
                const appNames = this._getDeclApps(decl, true);
                span.finish();
                return appNames;
            });
    }

    listApplications(ctx) {
        const span = this._buildAndStartSpan('listApplications', ctx);
        return this._getDecl(span)
            .then((decl) => {
                const appList = this._getDeclApps(decl, true);
                span.finish();
                return appList.map(([tenantName, appName]) => _appFromDecl(decl, tenantName, appName));
            });
    }

    getApplication(tenant, app, ctx) {
        const span = this._buildAndStartSpan('getApplication', ctx);
        return this._getDecl(span)
            .then(decl => this._validateTenantApp(decl, tenant, app))
            .then((decl) => {
                span.finish();
                return Promise.resolve(_appFromDecl(decl, tenant, app));
            });
    }

    getTasks(ctx) {
        const span = this._buildAndStartSpan('getTasks', ctx);
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
        return this._updateAuthHeader()
            .then(() => this._getOpLock(span))
            .then(() => this._endpoint.get('/task'))
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
            .finally(() => {
                this._releaseOpLock(span);
                span.finish();
            });
    }

    _buildAndStartSpan(opName, ctx) {
        return ctx.tracer.startChildSpan(opName, ctx.span, { tags: { [TraceTags.APP.COMPONENT]: 'AS3Driver' } });
    }
}

module.exports = {
    AS3Driver,
    AS3DriverConstantsKey
};
