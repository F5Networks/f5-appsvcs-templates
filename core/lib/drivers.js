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

    listApplications() {
        return Promise.resolve(Object.keys(this._apps));
    }

    getApplication(appName) {
        return Promise.resolve(this._apps[appName]);
    }
}

class AS3Driver {
    constructor() {
        this._endpoint = '/mgmt/shared/appsvcs/declare';
    }

    _getKeysByClass(obj, className) {
        return Object.keys(obj).filter(key => obj[key].class === className);
    }

    _getDeclTenants(declaration) {
        return this._getKeysByClass(declaration, 'Tenant');
    }

    _getDeclApps(declaration) {
        const apps = [];
        this._getDeclTenants(declaration).forEach((tenant) => {
            this._getKeysByClass(declaration[tenant], 'Application').forEach((app) => {
                apps.push(`${tenant}:${app}`);
            });
        });
        return apps;
    }

    _stitchDecl(declaration, appDef) {
        const tenantList = this._getDeclTenants(appDef);
        if (tenantList.length === 0) {
            throw new Error('Did not find a tenant class in the application declaration');
        } else if (tenantList.length > 1) {
            throw new Error('Only one tenant class is supported for application declarations');
        }
        const appList = this._getDeclApps(appDef);
        if (appList.length === 0) {
            throw new Error('Did not find an application class in the application declaration');
        } else if (appList.length > 1) {
            throw new Error('Only one application class is supported for application declaration');
        }

        const [tenantName, appName] = appList[0].split(':');
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

    createApplication(appDef) {
        appDef = appDef.declaration || appDef;
        return this._getDecl()
            .then(decl => httpUtils.makePost(`${this._endpoint}?async=true`, this._stitchDecl(decl, appDef)));
    }

    listApplications() {
        return this._getDecl()
            .then(decl => this._getDeclApps(decl));
    }

    getApplication(appName) {
        const [tenant, app] = appName.split(':');
        return this._getDecl()
            .then(decl => decl[tenant][app]);
    }
}

module.exports = {
    NullDriver,
    AS3Driver
};
