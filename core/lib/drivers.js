'use strict';

const httpUtils = require('./http_utils');

class NullDriver {
    constructor() {
        this._apps = {};
    }

    createApplication(appName, appDef) {
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
        this._endpoint = '/mgmt/shared/appsvcs/declare?async=true';
        this._apps = {};
    }

    _getKeysByClass(obj, className) {
        return Object.keys(obj).filter(key => obj[key].class === className);
    }

    _getDeclTenants(declaration) {
        const decl = declaration.declaration || declaration;
        return this._getKeysByClass(decl, 'Tenant').reduce((acc, curr) => {
            acc[curr] = decl[curr];
            return acc;
        }, {});
    }

    _getDeclaration() {
        const _declarationStub = {
            class: 'ADC',
            schemaVersion: '3.0.0'
        };
        return Object.keys(this._apps).reduce((acc, curr) => {
            const appDef = this._apps[curr];
            const tenants = this._getDeclTenants(appDef);
            Object.keys(tenants).forEach((tenant) => {
                acc[tenant] = Object.assign({}, acc[tenant] || {}, tenants[tenant]);
            });
            return acc;
        }, _declarationStub);
    }

    createApplication(appName, appDef) {
        this._apps[appName] = appDef;
        return httpUtils.makePost(this._endpoint, this._getDeclaration());
    }

    listApplications() {
        return Promise.resolve(Object.keys(this._apps));
    }

    getApplication(appName) {
        return Promise.resolve(this._apps[appName]);
    }
}

module.exports = {
    NullDriver,
    AS3Driver
};
