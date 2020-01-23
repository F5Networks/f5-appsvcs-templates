'use strict';

const httpUtils = require('./http_utils');

class NullDriver {
    constructor() {
        this._apps = {};
    }

    createApplication(appDef) {
        const appName = appDef.name;
        this._apps[appName] = appDef;
        return Promise.resolve({
        });
    }

    deleteApplication(tenant, app) {
        delete this._apps[app];
        return Promise.resolve();
    }

    listApplications() {
        return Promise.resolve(Object.keys(this._apps));
    }

    getApplication(_tenant, app) {
        return Promise.resolve(this._apps[app]);
    }
}

class AS3Driver {
    constructor() {
        this._endpoint = '/mgmt/shared/appsvcs/declare';
        this._constkey = 'mystique';
    }

    _getKeysByClass(obj, className) {
        return Object.keys(obj).filter(key => obj[key].class === className);
    }

    _getDeclTenants(declaration) {
        return this._getKeysByClass(declaration, 'Tenant');
    }

    _getDeclApps(declaration, onlyMystique) {
        const apps = [];
        this._getDeclTenants(declaration).forEach((tenant) => {
            this._getKeysByClass(declaration[tenant], 'Application').forEach((app) => {
                const appDef = declaration[tenant][app];
                if (!onlyMystique || (appDef.constants && appDef.constants[this._constkey])) {
                    apps.push([tenant, app]);
                }
            });
        });
        return apps;
    }

    _stitchDecl(declaration, appDef) {
        const [tenantName, appName] = this._getDeclApps(appDef)[0];
        if (!declaration[tenantName]) {
            declaration[tenantName] = {
                class: 'Tenant'
            };
        }
        declaration[tenantName][appName] = appDef[tenantName][appName];
        return declaration;
    }

    _getDecl() {
        return httpUtils.makeGet(this._endpoint)
            .then(res => res.body.declaration || res.body)
            .then((decl) => {
                if (Object.keys(decl).length === 0) {
                    return {
                        class: 'ADC',
                        schemaVersion: '3.0.0'
                    };
                }
                return decl;
            });
    }

    createApplication(appDef, metaData) {
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
            [this._constkey]: metaData
        });

        return this._getDecl()
            .then(decl => this._stitchDecl(decl, appDef))
            .then(decl => httpUtils.makePost(`${this._endpoint}?async=true`, decl));
    }

    _validateTenantApp(decl, tenant, app) {
        if (!decl[tenant]) {
            return Promise.reject(new Error(`no tenant found for tenant name: ${tenant}`));
        }
        if (!decl[tenant][app]) {
            return Promise.reject(new Error(`could not find application ${tenant}/${app}`));
        }
        if (!decl[tenant][app].constants || !decl[tenant][app].constants[this._constkey]) {
            return Promise.reject(new Error(`application is not managed by Mystique: ${tenant}/${app}`));
        }
        return Promise.resolve(decl);
    }

    deleteApplication(tenant, app) {
        return this._getDecl()
            .then(decl => this._validateTenantApp(decl, tenant, app))
            .then((decl) => {
                delete decl[tenant][app];
                if (this._getKeysByClass(decl[tenant], 'Application').length === 0) {
                    delete decl[tenant];
                }
                return Promise.resolve(decl);
            })
            .then(decl => httpUtils.makePost(`${this._endpoint}?async=true`, decl));
    }

    listApplications() {
        return this._getDecl()
            .then(decl => this._getDeclApps(decl, true));
    }

    getApplication(tenant, app) {
        return this._getDecl()
            .then(decl => this._validateTenantApp(decl, tenant, app))
            .then(decl => Promise.resolve(decl[tenant][app].constants[this._constkey]));
    }
}

module.exports = {
    NullDriver,
    AS3Driver
};
