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

/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const nock = require('nock');
const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const { AS3Driver, AS3DriverConstantsKey } = require('../../lib/drivers');
const Tracer = require('../../lib/tracer').Tracer;

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

    const mockCtx = {
        tracer: new Tracer('test', { enabled: false })
    };

    const host = 'http://localhost:8100';

    beforeEach(function () {
        this.clock = sinon.useFakeTimers();
        mockCtx.span = mockCtx.tracer.startSpan('testMethod');
    });

    afterEach(function () {
        nock.cleanAll();
        this.clock.restore();
    });

    const mockAS3 = (body, code) => {
        code = code || 200;
        nock(host)
            .persist()
            .get(as3ep)
            .query(true)
            .reply(code, body);
    };

    it('app_stitching', function () {
        const driver = new AS3Driver();
        const decl = Object.assign({}, as3stub);
        driver._static_id = 'STATIC';
        driver._stitchDecl(decl, appDef);
        assert.deepStrictEqual(decl, Object.assign({}, as3stub, appDef, { id: 'STATIC' }));
    });
    it('get_decl', function () {
        const driver = new AS3Driver();
        mockAS3(as3stub);

        return assert.becomes(driver._getDecl(mockCtx.span), as3stub);
    });
    it('get_decl_empty_204', function () {
        const driver = new AS3Driver();
        mockAS3('', 204);

        return assert.becomes(driver._getDecl(mockCtx.span), as3stub);
    });
    it('get_decl_retry', function () {
        const driver = new AS3Driver();
        nock(host)
            .get(as3ep)
            .query(true)
            .reply(500, {})
            .get(as3ep)
            .query(true)
            .reply(200, as3stub);

        return assert.becomes(driver._getDecl(mockCtx.span), as3stub);
    });
    it('get_tenant_and_app_from_decl', function () {
        const driver = new AS3Driver();
        return assert.becomes(
            driver.getTenantAndAppFromDecl(as3WithApp),
            ['tenantName', 'appName']
        );
    });
    it('list_app_names_empty', function () {
        const driver = new AS3Driver();
        mockAS3(as3stub);
        return assert.becomes(driver.listApplicationNames(mockCtx), []);
    });
    it('list_app_names', function () {
        const driver = new AS3Driver();
        mockAS3(as3WithApp);
        console.log(JSON.stringify(as3WithApp, null, 2));
        return assert.becomes(driver.listApplicationNames(mockCtx), [['tenantName', 'appName']]);
    });
    it('list_apps', function () {
        const driver = new AS3Driver();
        mockAS3(as3WithApp);
        console.log(JSON.stringify(as3WithApp, null, 2));
        return assert.becomes(driver.listApplications(mockCtx), [appMetadata]);
    });
    it('get_app', function () {
        const driver = new AS3Driver();
        mockAS3(as3WithApp);
        return assert.becomes(driver.getApplication('tenantName', 'appName', mockCtx), appMetadata);
    });
    it('create_app', function () {
        const driver = new AS3Driver();
        driver._static_id = 'STATIC';
        mockAS3(as3stub);

        nock(host)
            .post(`${as3ep}/tenantName`, Object.assign({}, as3WithApp, { id: 'STATIC' }))
            .query(true)
            .reply(202, {});

        return assert.isFulfilled(driver.createApplication(appDef, appMetadata, mockCtx));
    });
    it('create_app_user_agent', function () {
        const driver = new AS3Driver({ userAgent: 'foo-bar/1.0' });
        driver._static_id = 'STATIC';
        mockAS3(as3stub);

        nock(host)
            .post(`${as3ep}/tenantName`, Object.assign({}, as3WithApp, {
                id: 'STATIC',
                controls: {
                    class: 'Controls',
                    userAgent: 'foo-bar/1.0'
                }
            }))
            .query(true)
            .reply(202, {});

        return assert.isFulfilled(driver.createApplication(appDef, appMetadata, mockCtx));
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
        const thirdAppDef = {
            otherTenant: {
                class: 'Tenant',
                thirdApp: {
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
        as3WithMultipleApps.otherTenant = {
            class: 'Tenant',
            thirdApp: {
                class: 'Application',
                constants: {
                    class: 'Constants',
                    [AS3DriverConstantsKey]: appMetadata
                }
            }
        };

        mockAS3(as3stub);

        nock(host)
            .post(`${as3ep}/tenantName,otherTenant`, as3WithMultipleApps)
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
            },
            {
                appDef: thirdAppDef,
                metaData: appMetadata
            }
        ], mockCtx)
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
        mockAS3(as3WithApp);

        nock(host)
            .persist()
            .post(`${as3ep}/tenantName`)
            .query(true)
            .reply(202, {});

        return assert.isFulfilled(driver.deleteApplication('tenantName', 'appName', mockCtx));
    });
    it('delete_all_apps', function () {
        const driver = new AS3Driver();
        mockAS3(as3WithApp);

        nock(host)
            .persist()
            .post(`${as3ep}/tenantName`)
            .query(true)
            .reply(202, {});

        return assert.isFulfilled(driver.deleteApplications(undefined, mockCtx));
    });
    it('create_app_bad', function () {
        const driver = new AS3Driver();

        mockAS3(as3stub);

        return assert.isRejected(driver.createApplication(appDef,
            { class: 'Application' }, mockCtx), /cannot contain the class key/)
            .then(() => assert.isRejected(driver.createApplication({
                appName: {
                    class: 'Application'
                }
            }, undefined, mockCtx), /Did not find a tenant/))
            .then(() => assert.isRejected(driver.createApplication({
                tenantName1: {
                    class: 'Tenant'
                },
                tenantName2: {
                    class: 'Tenant'
                }
            }, undefined, mockCtx), /Only one tenant/))
            .then(() => assert.isRejected(driver.createApplication({
                tenantName: {
                    class: 'Tenant'
                }
            }, undefined, mockCtx), /Did not find an application/))
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
            }, undefined, mockCtx), /Only one application/));
    });
    it('get_app_bad', function () {
        const driver = new AS3Driver();
        mockAS3(as3WithApp);
        return assert.isRejected(driver.getApplication('badTenent', 'appName', mockCtx), /no tenant found/)
            .then(() => assert.isRejected(driver.getApplication('tenantName', 'badApp', mockCtx), /could not find app/));
    });
    it('get_app_unmanaged', function () {
        const driver = new AS3Driver();
        mockAS3(Object.assign({}, as3stub, appDef));
        return assert.isRejected(driver.getApplication('tenantName', 'appName', mockCtx), /application is not managed/);
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
                            tenant: 'other',
                            host: 'foobar'
                        },
                        {
                            code: 200,
                            message: 'success',
                            tenant: 'tenantName',
                            host: 'foobar'
                        }],
                        declaration: Object.assign({}, as3WithApp, {
                            id: `${AS3DriverConstantsKey}%update%tenantName%appName%0-0-0-0-0`,
                            controls: {
                                archiveTimestamp: '2021-05-05T17:14:24.794Z'
                            }
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
                operation: 'delete',
                timestamp: new Date().toISOString(),
                host: 'localhost'
            },
            {
                application: 'appName',
                id: 'foo2',
                code: 200,
                message: 'success',
                name: appMetadata.template,
                parameters: appMetadata.view,
                tenant: 'tenantName',
                operation: 'update',
                timestamp: '2021-05-05T17:14:24.794Z',
                host: 'foobar'
            }
        ]);
    });
});
