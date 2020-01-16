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
                    apps.push(`${tenant}:${app}`);
                }
            });
        });
        return apps;
    }

    _stitchDecl(declaration, appDef) {
        const [tenantName, appName] = this._getDeclApps(appDef)[0].split(':');
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
        appDef = appDef.declaration || appDef;
        metaData = metaData || {};

        if (metaData.class) {
            return Promise.reject(new Error('metaData cannot contain the class key'));
        }

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
        if (!appDef[tenantName][appName].constants) {
            appDef[tenantName][appName].constants = {
                class: 'Constants'
            };
        }
        Object.assign(appDef[tenantName][appName].constants, {
            [this._constkey]: metaData
        });
        return this._getDecl()
            .then(decl => httpUtils.makePost(`${this._endpoint}?async=true`, this._stitchDecl(decl, appDef)));
    }

    listApplications() {
        return this._getDecl()
            .then(decl => this._getDeclApps(decl, true));
    }

    getApplication(appName) {
        const [tenant, app] = appName.split(':');
        if (!app) {
            return Promise.reject(new Error(`missing app portion of application name: ${appName}`));
        }
        return this._getDecl()
            .then((decl) => {
                if (!decl[tenant]) {
                    return Promise.reject(new Error(`no tenant found for tenant name: ${tenant}`));
                }
                if (!decl[tenant][app]) {
                    return Promise.reject(new Error(`could not find application ${appName}`));
                }
                if (!decl[tenant][app].constants || !decl[tenant][app].constants[this._constkey]) {
                    return Promise.reject(new Error(`application is not managed by Mystique: ${appName}`));
                }
                return decl[tenant][app].constants[this._constkey];
            });
    }
}

module.exports = {
    NullDriver,
    AS3Driver
};
