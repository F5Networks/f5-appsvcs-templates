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

describe('AS3 Driver tests', function () {
    const as3ep = '/mgmt/shared/appsvcs/declare';
    const as3TaskEp = '/mgmt/shared/appsvcs/task';
    const host = 'http://localhost:8100';

    let appDef;
    let as3stub;
    let appMetadata;
    let as3WithApp;

    beforeEach(function () {
        appDef = {
            tenantName: {
                class: 'Tenant',
                appName: {
                    class: 'Application'
                }
            }
        };
        as3stub = {
            class: 'ADC',
            schemaVersion: '3.0.0'
        };
        appMetadata = {
            template: 'foo',
            tenant: 'tenantName',
            name: 'appName',
            view: {
                bar: 'baz'
            }
        };
        as3WithApp = Object.assign({}, as3stub, {
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
        this.clock = sinon.useFakeTimers();
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

        return assert.becomes(driver._getDecl(), as3stub);
    });
    it('get_decl_empty_204', function () {
        const driver = new AS3Driver();
        mockAS3('', 204);

        return assert.becomes(driver._getDecl(), as3stub);
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

        return assert.becomes(driver._getDecl(), as3stub);
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
        return assert.becomes(driver.listApplicationNames(), []);
    });
    it('list_app_names', function () {
        const driver = new AS3Driver();
        mockAS3(as3WithApp);
        console.log(JSON.stringify(as3WithApp, null, 2));
        return assert.becomes(driver.listApplicationNames(), [['tenantName', 'appName']]);
    });
    it('list_apps', function () {
        const driver = new AS3Driver();
        mockAS3(as3WithApp);
        console.log(JSON.stringify(as3WithApp, null, 2));
        return assert.becomes(driver.listApplications(), [appMetadata]);
    });
    it('list_app', function () {
        const driver = new AS3Driver();
        mockAS3(as3WithApp);
        console.log(JSON.stringify(as3WithApp, null, 2));
        const asdf = driver.listApplication('tenantName', 'appName');
        console.log(`JDK asdf: ${JSON.stringify(appMetadata)}`);
        return assert.becomes(asdf, {
            class: 'Application',
            constants: {
                class: 'Constants',
                fast: appMetadata
            },
            _links: undefined
        });
    });
    it('list_apps_500_error', function () {
        const driver = new AS3Driver();
        nock(host)
            .get(as3ep)
            .query(true)
            .reply(500, {})
            .persist();

        return assert.isRejected(driver.listApplicationNames(), 'AS3 Driver failed to GET declaration');
    });
    it('get_app', function () {
        const driver = new AS3Driver();
        mockAS3(as3WithApp);
        return assert.becomes(driver.getApplication('tenantName', 'appName'), appMetadata);
    });
    it('create_app', function () {
        const driver = new AS3Driver();
        driver._static_id = 'STATIC';
        mockAS3(as3stub);

        nock(host)
            .post(`${as3ep}/tenantName`, Object.assign({}, as3WithApp, { id: 'STATIC' }))
            .query(true)
            .reply(202, {});

        return assert.isFulfilled(driver.createApplication(appDef, appMetadata));
    });
    it('create_app_with_retries', function () {
        this.clock.restore();
        const driver = new AS3Driver();
        driver._static_id = 'STATIC';
        mockAS3(as3stub);

        nock(host)
            .post(`${as3ep}/tenantName`, Object.assign({}, as3WithApp, { id: 'STATIC' }))
            .query(true)
            .reply(503)
            .post(`${as3ep}/tenantName`, Object.assign({}, as3WithApp, { id: 'STATIC' }))
            .query(true)
            .reply(503)
            .post(`${as3ep}/tenantName`, Object.assign({}, as3WithApp, { id: 'STATIC' }))
            .query(true)
            .reply(503)
            .post(`${as3ep}/tenantName`, Object.assign({}, as3WithApp, { id: 'STATIC' }))
            .query(true)
            .reply(202, {});

        return assert.isFulfilled(driver.createApplication(appDef, appMetadata));
    });
    it('create_app_with_route_domain', function () {
        const driver = new AS3Driver();
        driver._static_id = 'STATIC';
        mockAS3(as3stub);

        appDef = {
            tenantName: {
                class: 'Tenant',
                defaultRouteDomain: 0,
                appName: {
                    class: 'Application'
                }
            }
        };

        return driver._prepareAppDef(appDef)
            .then(preparedDef => driver._stitchDecl(as3stub, preparedDef))
            .then(decl => assert.deepInclude(JSON.stringify(decl), 'defaultRouteDomain'));
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
        mockAS3(as3WithApp);

        nock(host)
            .persist()
            .post(`${as3ep}/tenantName`)
            .query(true)
            .reply(202, {});

        return assert.isFulfilled(driver.deleteApplication('tenantName', 'appName'));
    });
    it('delete_all_apps', function () {
        const driver = new AS3Driver();
        mockAS3(as3WithApp);

        nock(host)
            .persist()
            .post(`${as3ep}/tenantName`)
            .query(true)
            .reply(202, {});

        return assert.isFulfilled(driver.deleteApplications(undefined));
    });
    it('create_app_bad', function () {
        const driver = new AS3Driver();

        mockAS3(as3stub);

        return assert.isRejected(driver.createApplication(appDef, { class: 'Application' }), /cannot contain the class key/)
            .then(() => assert.isRejected(driver.createApplication({
                appName: {
                    class: 'Application'
                }
            }, undefined), /Did not find a tenant/))
            .then(() => assert.isRejected(driver.createApplication({
                tenantName1: {
                    class: 'Tenant'
                },
                tenantName2: {
                    class: 'Tenant'
                }
            }, undefined), /Only one tenant/))
            .then(() => assert.isRejected(driver.createApplication({
                tenantName: {
                    class: 'Tenant'
                }
            }, undefined), /Did not find an application/))
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
            }, undefined), /Only one application/));
    });
    it('create_app_return_200', function () {
        const driver = new AS3Driver();
        driver._static_id = 'STATIC';
        mockAS3(as3stub);

        nock(host)
            .post(`${as3ep}/tenantName`, Object.assign({}, as3WithApp, { id: 'STATIC' }))
            .query(true)
            .reply(200, {});

        return assert.isRejected(driver.createApplication(appDef, appMetadata));
    });
    it('get_app_bad', function () {
        const driver = new AS3Driver();
        mockAS3(as3WithApp);
        return assert.isRejected(driver.getApplication('badTenent', 'appName'), /no tenant found/)
            .then(() => assert.isRejected(driver.getApplication('tenantName', 'badApp'), /could not find app/));
    });
    it('get_app_unmanaged', function () {
        const driver = new AS3Driver();
        mockAS3(Object.assign({}, as3stub, appDef));
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
    it('get_tasks_500_error', function () {
        const driver = new AS3Driver();
        nock(host)
            .get(as3TaskEp)
            .reply(500, {})
            .persist();

        return assert.isRejected(driver.getTasks(), 'AS3 Driver failed to GET tasks');
    });
    it('set_auth_token', function () {
        const getAuthToken = () => Promise.resolve('secret');
        const driver = new AS3Driver({
            getAuthToken
        });
        const scope = nock(host, {
            reqheaders: {
                authorization: 'Bearer secret'
            }
        })
            .persist()
            .get(as3ep)
            .query(true)
            .reply(200, {});
        return driver.getRawDeclaration()
            .then(() => assert(scope.isDone(), 'no request was sent to AS3'));
    });
    it('burst_handling', function () {
        this.clock.restore();
        const driver = new AS3Driver();
        driver._static_id = 'STATIC';
        mockAS3(as3stub);
        nock(host)
            .persist()
            .post(`${as3ep}/tenantName`, Object.assign({}, as3WithApp, { id: 'STATIC' }))
            .query(true)
            .reply(202, {
                id: 'task1'
            });

        return Promise.resolve()
            .then(() => Promise.all([
                driver.createApplication(appDef, appMetadata),
                driver.createApplication(appDef, appMetadata)
            ]))
            .then((results) => {
                results.forEach((result) => {
                    assert.strictEqual(result.status, 202);
                });
                assert.strictEqual(results[0].data.id, 'task1');
                assert.notStrictEqual(results[1].data.id, '');
            })
            .then(() => nock(host)
                .persist()
                .get(as3TaskEp)
                .reply(200, [
                    {
                        id: 'task1',
                        results: [{
                            code: 200,
                            message: 'success'
                        }],
                        declaration: {}
                    }
                ]))
            .then(() => driver.getTasks())
            .then((tasks) => {
                console.log(tasks);
                assert.strictEqual(tasks.length, 2);

                const firstTask = tasks[1];
                assert.strictEqual(firstTask.message, 'success');

                const secondTask = tasks[0];
                assert.strictEqual(secondTask.message, 'pending');
                assert.strictEqual(secondTask.tenant, 'tenantName');
                assert.strictEqual(secondTask.application, 'appName');
            })
            .finally(() => clearTimeout(driver._pendingTasksTimeout));
    });
});
