/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const nock = require('nock');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const { NullDriver, AS3Driver } = require('../lib/drivers');

describe('Null Driver tests', function () {
    it('add_app', function () {
        const driver = new NullDriver();
        const appDef = {
            name: 'appy'
        };

        return assert.becomes(driver.listApplications(), [])
            .then(() => driver.createApplication(appDef))
            .then(() => assert.becomes(driver.listApplications(), ['appy']))
            .then(() => assert.becomes(driver.getApplication(null, 'appy'), appDef));
    });
});

describe('AS3 Driver tests', function () {
    const appDef = {
        tenantName: {
            class: 'Tenant',
            appName: {
                class: 'Application'
            }
        }
    };
    const as3ep = '/mgmt/shared/appsvcs/declare';
    const as3stub = {
        class: 'ADC',
        schemaVersion: '3.0.0'
    };
    const as3WithApp = Object.assign({}, as3stub, {
        tenantName: {
            class: 'Tenant',
            appName: {
                class: 'Application',
                constants: {
                    class: 'Constants',
                    mystique: { foo: 'bar' }
                }
            }
        }
    });

    const host = 'http://localhost:8100';

    afterEach(function () {
        nock.cleanAll();
    });

    it('app_stitching', function () {
        const driver = new AS3Driver();
        const decl = Object.assign({}, as3stub);
        driver._stitchDecl(decl, appDef);
        assert.deepStrictEqual(decl, Object.assign({}, as3stub, appDef));
    });
    it('get_decl', function () {
        const driver = new AS3Driver();
        nock(host)
            .get(as3ep)
            .reply(200, as3stub);

        return assert.becomes(driver._getDecl(), as3stub);
    });
    it('get_decl_empty_204', function () {
        const driver = new AS3Driver();
        nock(host)
            .get(as3ep)
            .reply(204, '');

        return assert.becomes(driver._getDecl(), as3stub);
    });
    it('list_apps_empty', function () {
        const driver = new AS3Driver();
        nock(host)
            .persist()
            .get(as3ep)
            .reply(200, as3stub);
        return assert.becomes(driver.listApplications(), []);
    });
    it('list_apps', function () {
        const driver = new AS3Driver();
        nock(host)
            .persist()
            .get(as3ep)
            .reply(200, as3WithApp);
        return assert.becomes(driver.listApplications(), [['tenantName', 'appName']]);
    });
    it('get_app', function () {
        const driver = new AS3Driver();
        nock(host)
            .persist()
            .get(as3ep)
            .reply(200, as3WithApp);
        return assert.becomes(driver.getApplication('tenantName', 'appName'), { foo: 'bar' });
    });
    it('create_app', function () {
        const driver = new AS3Driver();
        nock(host)
            .persist()
            .get(as3ep)
            .reply(200, as3stub);

        nock(host)
            .persist()
            .post(as3ep, as3WithApp)
            .query(true)
            .reply(202, {});

        return assert.isFulfilled(driver.createApplication(appDef, {
            foo: 'bar'
        }));
    });
    it('delete_app', function () {
        const driver = new AS3Driver();
        nock(host)
            .persist()
            .get(as3ep)
            .reply(200, as3WithApp);

        nock(host)
            .persist()
            .post(as3ep, as3stub)
            .query(true)
            .reply(202, {});

        return assert.isFulfilled(driver.deleteApplication('tenantName', 'appName'));
    });
    it('create_app_bad', function () {
        const driver = new AS3Driver();

        return assert.isRejected(driver.createApplication(appDef, { class: 'Application' }), /cannot contain the class key/)
            .then(() => assert.isRejected(driver.createApplication({
                appName: {
                    class: 'Application'
                }
            }), /Did not find a tenant/))
            .then(() => assert.isRejected(driver.createApplication({
                tenantName1: {
                    class: 'Tenant'
                },
                tenantName2: {
                    class: 'Tenant'
                }
            }), /Only one tenant/))
            .then(() => assert.isRejected(driver.createApplication({
                tenantName: {
                    class: 'Tenant'
                }
            }), /Did not find an application/))
            .then(() => assert.isRejected(driver.createApplication({
                tenantName: {
                    class: 'Tenant',
                    appName1: {
                        class: 'Application'
                    },
                    appName2: {
                        class: 'Application'
                    }
                }
            }), /Only one application/));
    });
    it('get_app_bad', function () {
        const driver = new AS3Driver();
        nock(host)
            .persist()
            .get(as3ep)
            .reply(404, as3WithApp);

        return assert.isRejected(driver.getApplication('badTenent', 'appName'), /no tenant found/)
            .then(() => assert.isRejected(driver.getApplication('tenantName', 'badApp'), /could not find app/));
    });
    it('get_app_unmanaged', function () {
        const driver = new AS3Driver();
        nock(host)
            .get(as3ep)
            .reply(404, Object.assign({}, as3stub, appDef));

        return assert.isRejected(driver.getApplication('tenantName', 'appName'), /application is not managed/);
    });
});
