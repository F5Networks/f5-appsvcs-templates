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
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');

const fast = require('@f5devcentral/f5-fast-core');

const AS3DriverConstantsKey = 'fast';

class AS3Driver {
    constructor(options) {
        options = options || {};
        const endPointUrl = options.endPointUrl || 'http://localhost:8100/mgmt/shared/appsvcs';
        const bigipUser = options.bigipUser || 'admin';
        const bigipPassword = options.bigipPassword || '';
        if (typeof options.strictCerts === 'undefined') {
            options.strictCerts = true;
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
                rejectUnauthorized: options.strictCerts,
                keepAlive: false
            })
        };
        if (options.apiToken) {
            axiosConfig.headers = {
                Authorization: `Bearer ${options.apiToken}`
            };
        } else if (!options.getAuthToken) {
            axiosConfig.auth = {
                username: bigipUser,
                password: bigipPassword
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
    }

    _waitForOpLock() {
        const start = Date.now();
        const timeout = 1000;
        const self = this;
        return new Promise((resolve, reject) => {
            function checkVal() {
                if (!self._opInProgress) {
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

    _getOpLock() {
        return Promise.resolve()
            .then(() => this._waitForOpLock())
            .then(() => {
                this._opInProgress = true;
            });
    }

    _releaseOpLock() {
        return Promise.resolve()
            .then(() => {
                this._opInProgress = false;
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

    _setAuthHeader() {
        if (!this._getAuthToken) {
            return Promise.resolve();
        }
        return this._getAuthToken()
            .then((token) => {
                this._endpoint.defaults.headers.common.Authorization = `Bearer ${token}`;
            });
    }

    getInfo() {
        return this._setAuthHeader()
            .then(() => this._endpoint.get('/info', {
                validateStatus: () => true // ignore failure status codes
            }));
    }

    getSettings() {
        if (!this._tsMixin) {
            return Promise.resolve({});
        }
        return Promise.resolve(Object.assign(
            {},
            this._tsMixin.getCombinedParameters({}),
            this._tsOptions
        ))
            .then((settings) => {
                settings.ipamProviders = this._setIpamDefaults(settings);
            });
    }

    _setIpamDefaults(settings) {
        let ipamProviders = settings.ipamProviders;
        // for compatibility with v1.9
        if (Array.isArray(ipamProviders)) {
            ipamProviders = settings.ipamProviders.map((prov) => {
                if (typeof prov.serviceType === 'undefined') {
                    prov.serviceType = 'Generic';
                }
                return prov;
            });
        }
        return ipamProviders;
    }

    _getSettingsDecl() {
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
            .then(() => this._getDecl())
            .then((decl) => {
                if (decl.Common && decl.Common.Shared) {
                    Object.assign(combDecl.Common.Shared, decl.Common.Shared);
                }
                Object.keys(combDecl.Common.Shared).forEach((item) => {
                    if (item.startsWith('fast_telemetry')) {
                        delete combDecl.Common.Shared[item];
                    }
                });

                if (settingsDecl.Common && settingsDecl.Common.Shared) {
                    Object.assign(combDecl.Common.Shared, settingsDecl.Common.Shared);
                }

                if (Object.keys(combDecl.Common.Shared).length <= 2) { // ['class', 'template']
                    delete combDecl.Common.Shared;
                }

                return combDecl;
            });
    }

    setSettings(settings, provisionData, skipPost) {
        const provisionedModules = provisionData[0].items.filter(x => x.level !== 'none').map(x => x.name);
        settings.log_afm = (
            settings.enable_telemetry
            && provisionedModules.includes('afm')
            && provisionedModules.includes('asm')
        );
        settings.log_asm = (
            settings.enable_telemetry
            && provisionedModules.includes('asm')
        );
        settings.ipamProviders = this._setIpamDefaults(settings);

        const newOpts = Object.assign(
            {},
            this._tsOptions,
            settings
        );

        this._tsOptions = newOpts;

        this._useDeclCache = !settings.disableDeclarationCache;

        if (!this._tsMixin || skipPost) {
            return Promise.resolve();
        }

        this._declCache = null;
        return Promise.resolve()
            .then(() => this._getSettingsDecl())
            .then(decl => this._postDecl(decl, 'Common'));
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

    _appFromDecl(declaration, tenant, app) {
        const as3App = declaration[tenant][app];
        const fastApp = (as3App.constants && as3App.constants[AS3DriverConstantsKey]) || {};
        return Object.assign({}, fastApp, {
            tenant,
            name: app
        });
    }

    _getDecl() {
        if (this._declCache) {
            return Promise.resolve(JSON.parse(JSON.stringify(this._declCache)));
        }

        const getUrl = `/declare${this._useOptimisticLock ? '?showHash=true' : ''}`;

        return this._setAuthHeader()
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
                return decl;
            })
            .catch(e => this._handleAS3Error('GET', e));
    }

    getRawDeclaration() {
        return this._setAuthHeader()
            .then(() => this._endpoint.get('/declare'));
    }

    _handleAS3Error(method, err, resource) {
        resource = resource || 'declaration';

        let msg = err.message;
        if (err.response) {
            const rspData = err.response.data;
            msg = `${msg}\n${rspData.message}`;
            if (rspData.errors) {
                msg = `${msg}\nerrors:\n${JSON.stringify(rspData.errors, null, 2)}`;
            }
        }
        return Promise.reject(new Error(
            `AS3 Driver failed to ${method} ${resource}: ${msg}`
        ));
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

        this._declCache = null;
        return this._setAuthHeader()
            .then(() => this._endpoint.post(`/declare${tenants}?async=true`, decl))
            .then((result) => {
                result.body = result.data;
                this._task_ids[result.body.id] = decl.id;
                this._declCache = null;
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

    createApplication(appDef, metaData) {
        return Promise.resolve()
            .then(() => this.createApplications([{ appDef, metaData }]));
    }

    createApplications(appsData) {
        const tenants = [];
        return Promise.resolve()
            .then(() => this._getOpLock())
            .then(() => {
                // Ensure we are not using a stale declaration
                this._declCache = null;
            })
            .then(() => Promise.all([
                Promise.all(appsData.map(data => this._prepareAppDef(data.appDef, data.metaData))),
                this._getDecl()
            ]))
            .then(([appDefs, decl]) => {
                appDefs.forEach((appDef) => {
                    tenants.push(this._getDeclTenants(appDef)[0]);
                });
                return Promise.all(
                    appDefs.map(appDef => this._stitchDecl(decl, appDef))
                );
            })
            .then(declList => declList[0])
            .then(decl => this._postDecl(decl, tenants))
            .finally(() => this._releaseOpLock());
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

    deleteApplication(tenant, app) {
        return Promise.resolve()
            .then(() => this.deleteApplications([[tenant, app]]));
    }

    deleteApplications(appNames) {
        const doDeleteAll = !appNames || appNames.length === 0;
        const tenants = [];
        this._declCache = null;
        return Promise.resolve()
            .then(() => this._getOpLock())
            .then(() => {
                // Ensure we are not using a stale declaration
                this._declCache = null;
            })
            .then(() => this._getDecl())
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
                    .then(() => this.listApplicationNames())
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
            .then(decl => this._postDecl(decl, tenants))
            .finally(() => this._releaseOpLock());
    }

    listApplicationNames() {
        return this._getDecl()
            .then(decl => this._getDeclApps(decl, true));
    }

    listApplications() {
        return this._getDecl()
            .then((decl) => {
                const appList = this._getDeclApps(decl, true);
                return appList.map(([tenantName, appName]) => this._appFromDecl(decl, tenantName, appName));
            });
    }

    getApplication(tenant, app) {
        return this._getDecl()
            .then(decl => this._validateTenantApp(decl, tenant, app))
            .then(decl => Promise.resolve(this._appFromDecl(decl, tenant, app)));
    }

    getTasks() {
        const itemMatch = item => (
            (item.declaration.id && item.declaration.id.startsWith(AS3DriverConstantsKey))
            || this._task_ids[item.id]
        );
        const as3ToFAST = (item) => {
            let tenant = '';
            let application = '';
            let operation = 'unknown';
            let name = '';
            let parameters = {};
            let results = item.results;
            let host = 'unknown';
            if (item.declaration.id && this._task_ids[item.id]) {
                delete this._task_ids[item.id];
            }
            const declid = item.declaration.id || this._task_ids[item.id];
            if (declid) {
                const splitChar = (declid.search(/%/) !== -1) ? '%' : '-';
                const idParts = declid.split(splitChar);
                if (splitChar === '-' && idParts.length < 9) {
                    [tenant, application] = idParts.slice(1, 3);
                } else {
                    [operation, tenant, application] = idParts.slice(1, 4);
                }
                host = item.results[0].host || 'localhost';
                results = item.results.filter(r => r.tenant === tenant);
                if (results.length === 0) {
                    results = item.results;
                }
                if (item.declaration[tenant] && item.declaration[tenant][application]) {
                    const appDef = this._appFromDecl(item.declaration, tenant, application);
                    name = appDef.template;
                    parameters = appDef.view;
                }
            }
            const changes = [...new Set(results.filter(r => r.message).map(r => r.message))];
            const responses = [...new Set(results.filter(r => r.response).map(r => r.response))];
            const errors = [...new Set(results.filter(r => r.errors).map(r => r.errors))];
            let timestamp = (item.declaration && item.declaration.controls) ? item.declaration.controls.archiveTimestamp : '';
            if ([...changes].join() === 'in progress') {
                timestamp = new Date().toISOString();
            }
            return {
                id: item.id,
                code: item.results[0].code,
                message: [...changes, ...responses, ...errors].join('\n'),
                name,
                parameters,
                tenant,
                application,
                operation,
                timestamp,
                host
            };
        };
        return this._setAuthHeader()
            .then(() => this._endpoint.get('/task'))
            .then(result => result.data.items.filter(itemMatch).map(as3ToFAST))
            .catch(e => this._handleAS3Error('GET', e, 'tasks'));
    }
}

module.exports = {
    AS3Driver,
    AS3DriverConstantsKey
};
