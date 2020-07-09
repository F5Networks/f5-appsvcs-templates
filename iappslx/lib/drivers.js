'use strict';

const url = require('url');
const uuid4 = require('uuid').v4;
const httpUtils = require('@f5devcentral/f5-fast-core').httpUtils;

const AS3DriverConstantsKey = 'fast';

class AS3Driver {
    constructor(endPointUrl) {
        endPointUrl = endPointUrl || 'http://localhost:8100/mgmt/shared/appsvcs';
        const declareurl = url.parse(`${endPointUrl}/declare`);
        const tasksUrl = url.parse(`${endPointUrl}/task`);

        this._declareOpts = Object.assign({}, declareurl);
        this._taskOopts = Object.assign({}, tasksUrl);
        this._static_id = '';
        this._task_ids = {};

        this._declCache = null;
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
        return this._static_id || `${AS3DriverConstantsKey}%${operation}%${tenantName}%${appName}%${uuid4()}`;
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
        const opts = Object.assign({}, this._declareOpts, {
            method: 'GET',
            path: `${this._declareOpts.path}?showHash=true`
        });
        return httpUtils.makeRequest(opts)
            .then(res => res.body.declaration || res.body)
            .then((decl) => {
                if (Object.keys(decl).length === 0) {
                    return {
                        class: 'ADC',
                        schemaVersion: '3.0.0'
                    };
                }
                this._declCache = JSON.parse(JSON.stringify(decl));
                return decl;
            });
    }

    _postDecl(decl) {
        const opts = Object.assign({}, this._declareOpts, {
            method: 'POST',
            path: `${this._declareOpts.path}?async=true`
        });
        this._declCache = null;
        return httpUtils.makeRequest(opts, decl)
            .then((result) => {
                this._task_ids[result.body.id] = decl.id;
                this._declCache = null;
                return result;
            });
    }

    _prepareAppDef(appDef, metaData) {
        appDef = JSON.parse(JSON.stringify(appDef)); // copy appDef to avoid modifying it
        appDef = appDef.declaration || appDef;
        metaData = metaData || {};

        if (metaData.class) {
            return Promise.reject(new Error('metaData cannot contain the class key'));
        }

        const tenantList = this._getDeclTenants(appDef);
        if (tenantList.length === 0) {
            return Promise.reject(new Error('Did not find a tenant class in the application declaration'));
        }
        if (tenantList.length > 1) {
            return Promise.reject(new Error('Only one tenant class is supported for application declarations'));
        }
        const appList = this._getDeclApps(appDef);
        if (appList.length === 0) {
            return Promise.reject(new Error('Did not find an application class in the application declaration'));
        }
        if (appList.length > 1) {
            return Promise.reject(new Error('Only one application class is supported for application declaration'));
        }

        // Add constants
        const [tenantName, appName] = appList[0];
        if (!appDef[tenantName][appName].constants) {
            appDef[tenantName][appName].constants = {
                class: 'Constants'
            };
        }
        Object.assign(appDef[tenantName][appName].constants, {
            [AS3DriverConstantsKey]: metaData
        });

        return Promise.resolve(appDef);
    }


    createApplication(appDef, metaData) {
        return Promise.resolve()
            .then(() => this.createApplications([{ appDef, metaData }]));
    }

    createApplications(appsData) {
        return Promise.resolve()
            .then(() => Promise.all([
                Promise.all(appsData.map(data => this._prepareAppDef(data.appDef, data.metaData))),
                this._getDecl()
            ]))
            .then(([appDefs, decl]) => Promise.all(
                appDefs.map(appDef => this._stitchDecl(decl, appDef))
            ))
            .then(declList => this._postDecl(declList[0]));
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
        return Promise.resolve()
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
                    delete decl[tenant][app];
                });
                if (appNames.length === 1) {
                    decl.id = this._createUuid(appNames[0][0], appNames[0][1], 'delete');
                } else {
                    decl.id = this._createUuid('', '', (doDeleteAll) ? 'delete-all' : 'delete');
                }
                return Promise.resolve(decl);
            })
            .then(decl => this._postDecl(decl));
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
        const opts = Object.assign({}, this._taskOopts, {
            method: 'GET'
        });
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
                if (item.declaration[tenant] && item.declaration[tenant][application]) {
                    const appDef = this._appFromDecl(item.declaration, tenant, application);
                    name = appDef.template;
                    parameters = appDef.view;
                    results = item.results.filter(r => r.tenant === tenant);
                }
            }
            const changes = [...new Set(results.filter(r => r.message).map(r => r.message))];
            const responses = [...new Set(results.filter(r => r.response).map(r => r.response))];
            const errors = [...new Set(results.filter(r => r.error).map(r => r.error))];
            return {
                id: item.id,
                code: item.results[0].code,
                message: [...changes, ...responses, ...errors].join('\n'),
                name,
                parameters,
                tenant,
                application,
                operation
            };
        };
        return httpUtils.makeRequest(opts)
            .then(result => result.body.items.filter(itemMatch).map(as3ToFAST));
    }
}

module.exports = {
    AS3Driver,
    AS3DriverConstantsKey
};
