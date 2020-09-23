/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const nock = require('nock');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const { AS3Driver, AS3DriverConstantsKey } = require('../../iappslx/lib/drivers');

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
    const as3TaskEp = '/mgmt/shared/appsvcs/task';
    const as3stub = {
        class: 'ADC',
        schemaVersion: '3.0.0'
    };
    const appMetadata = {
        template: 'foo',
        tenant: 'tenantName',
        name: 'appName',
        view: {
            bar: 'baz'
        }
    };
    const as3WithApp = Object.assign({}, as3stub, {
        tenantName: {
            class: 'Tenant',
            appName: {
                class: 'Application',
                constants: {
                    class: 'Constants',
                    [AS3DriverConstantsKey]: appMetadata
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
        driver._static_id = 'STATIC';
        driver._stitchDecl(decl, appDef);
        assert.deepStrictEqual(decl, Object.assign({}, as3stub, appDef, { id: 'STATIC' }));
    });
    it('get_decl', function () {
        const driver = new AS3Driver();
        nock(host)
            .get(as3ep)
            .query(true)
            .reply(200, as3stub);

        return assert.becomes(driver._getDecl(), as3stub);
    });
    it('get_decl_empty_204', function () {
        const driver = new AS3Driver();
        nock(host)
            .get(as3ep)
            .query(true)
            .reply(204, '');

        return assert.becomes(driver._getDecl(), as3stub);
    });
    it('list_app_names_empty', function () {
        const driver = new AS3Driver();
        nock(host)
            .persist()
            .get(as3ep)
            .query(true)
            .reply(200, as3stub);
        return assert.becomes(driver.listApplicationNames(), []);
    });
    it('list_app_names', function () {
        const driver = new AS3Driver();
        nock(host)
            .persist()
            .get(as3ep)
            .query(true)
            .reply(200, as3WithApp);
        console.log(JSON.stringify(as3WithApp, null, 2));
        return assert.becomes(driver.listApplicationNames(), [['tenantName', 'appName']]);
    });
    it('list_apps', function () {
        const driver = new AS3Driver();
        nock(host)
            .persist()
            .get(as3ep)
            .query(true)
            .reply(200, as3WithApp);
        console.log(JSON.stringify(as3WithApp, null, 2));
        return assert.becomes(driver.listApplications(), [appMetadata]);
    });
    it('get_app', function () {
        const driver = new AS3Driver();
        nock(host)
            .persist()
            .get(as3ep)
            .query(true)
            .reply(200, as3WithApp);
        return assert.becomes(driver.getApplication('tenantName', 'appName'), appMetadata);
    });
    it('create_app', function () {
        const driver = new AS3Driver();
        driver._static_id = 'STATIC';
        nock(host)
            .persist()
            .get(as3ep)
            .query(true)
            .reply(200, as3stub);

        nock(host)
            .persist()
            .post(as3ep, Object.assign({}, as3WithApp, { id: 'STATIC' }))
            .query(true)
            .reply(202, {});

        return assert.isFulfilled(driver.createApplication(appDef, appMetadata));
    });
    it('create_multiple_apps', function () {
        const driver = new AS3Driver();
        driver._static_id = 'STATIC';

        const secondAppDef = {
            tenantName: {
                class: 'Tenant',
                secondApp: {
                    class: 'Application'
                }
            }
        };
        const as3WithMultipleApps = Object.assign({}, as3WithApp, { id: 'STATIC' });
        as3WithMultipleApps.tenantName.secondApp = {
            class: 'Application',
            constants: {
                class: 'Constants',
                [AS3DriverConstantsKey]: appMetadata
            }
        };
        nock(host)
            .persist()
            .get(as3ep)
            .query(true)
            .reply(200, as3stub);

        nock(host)
            .post(as3ep, as3WithMultipleApps)
            .query(true)
            .reply(202, {});

        return driver.createApplications([
            {
                appDef,
                metaData: appMetadata
            },
            {
                appDef: secondAppDef,
                metaData: appMetadata
            }
        ])
            .then((response) => {
                assert.strictEqual(response.status, 202);
            });
    });
    it('create_many_apps', function () {
        const driver = new AS3Driver();
        const appdefs = Array.from(Array(100).keys()).map(x => ({
            tenantName: {
                class: 'Tenant',
                [`app-${x}`]: {
                    class: 'Application'
                }
            }
        }));

        return Promise.resolve()
            .then(() => Promise.all(appdefs.map(x => driver._prepareAppDef(x))))
            .then(preparedDefs => Promise.all(
                preparedDefs.map(def => driver._stitchDecl(as3stub, def))
            ))
            .then((declList) => {
                console.log(JSON.stringify(declList[0], null, 2));
            });
    });
    it('delete_app', function () {
        const driver = new AS3Driver();
        nock(host)
            .persist()
            .get(as3ep)
            .query(true)
            .reply(200, as3WithApp);

        nock(host)
            .persist()
            .post(as3ep)
            .query(true)
            .reply(202, {});

        return assert.isFulfilled(driver.deleteApplication('tenantName', 'appName'));
    });
    it('delete_all_apps', function () {
        const driver = new AS3Driver();
        nock(host)
            .persist()
            .get(as3ep)
            .query(true)
            .reply(200, as3WithApp);

        nock(host)
            .persist()
            .post(as3ep)
            .query(true)
            .reply(202, {});

        return assert.isFulfilled(driver.deleteApplications());
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
            .query(true)
            .reply(200, as3WithApp);

        return assert.isRejected(driver.getApplication('badTenent', 'appName'), /no tenant found/)
            .then(() => assert.isRejected(driver.getApplication('tenantName', 'badApp'), /could not find app/));
    });
    it('get_app_unmanaged', function () {
        const driver = new AS3Driver();
        nock(host)
            .get(as3ep)
            .query(true)
            .reply(200, Object.assign({}, as3stub, appDef));

        return assert.isRejected(driver.getApplication('tenantName', 'appName'), /application is not managed/);
    });
    it('get_empty_tasks', function () {
        const driver = new AS3Driver();
        nock(host)
            .get(as3TaskEp)
            .reply(200, {
                items: []
            });

        return assert.becomes(driver.getTasks(), []);
    });
    it('get_tasks', function () {
        const driver = new AS3Driver();
        driver._task_ids.foo1 = `${AS3DriverConstantsKey}%delete%tenantName%appName%0-0-0-0-0`;
        nock(host)
            .get(as3TaskEp)
            .reply(200, {
                items: [
                    {
                        id: 'foo1',
                        results: [{
                            code: 200,
                            message: 'in progress'
                        }],
                        declaration: {}
                    },
                    {
                        id: 'foo2',
                        results: [{
                            code: 200,
                            message: 'no change',
                            tenant: 'other'
                        },
                        {
                            code: 200,
                            message: 'success',
                            tenant: 'tenantName'
                        }],
                        declaration: Object.assign({}, as3WithApp, {
                            id: `${AS3DriverConstantsKey}%update%tenantName%appName%0-0-0-0-0`
                        })
                    },
                    {
                        id: 'foo3',
                        results: [{
                            code: 200,
                            message: 'success'
                        }],
                        declaration: as3WithApp
                    }
                ]
            });
        return assert.becomes(driver.getTasks(), [
            {
                application: 'appName',
                id: 'foo1',
                code: 200,
                message: 'in progress',
                name: '',
                parameters: {},
                tenant: 'tenantName',
                operation: 'delete'
            },
            {
                application: 'appName',
                id: 'foo2',
                code: 200,
                message: 'success',
                name: appMetadata.template,
                parameters: appMetadata.view,
                tenant: 'tenantName',
                operation: 'update'
            }
        ]);
    });
});
