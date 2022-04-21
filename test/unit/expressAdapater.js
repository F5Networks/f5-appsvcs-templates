/* Copyright 2021 F5 Networks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const sinon = require('sinon');
const mock = require('mock-fs');
const fs = require('fs');
const axios = require('axios');
const http = require('http');
const https = require('https');
const expressAdapter = require('../../stand-alone/expressAdapter');

describe('Express Adapter', function () {
    let mockFastWorker01;
    let mockFastWorker02;
    let mockFastWorkerConfig01;
    let mockFastWorkerConfig02;
    this.timeout(6000);

    function assertFastWorker(fastWorker) {
        // validate logger
        assert.deepEqual(fastWorker.logger, {
            severe: console.error,
            error: console.error,
            info: console.log,
            fine: console.log,
            finest: console.log,
            log: console.log
        });
        // validate restHelper
        assert.ok(fastWorker.restHelper.makeRestjavadUri);
        // validate dependencies
        assert.strictEqual(fastWorker.dependencies.length, 0);
    }

    beforeEach(() => {
        mockFastWorkerConfig01 = {
            onStart: (success, error) => Promise.resolve(success, error),
            onStartCompleted: (success, error) => Promise.resolve(success, error),
            onGet: (success, error) => Promise.resolve(success, error),
            onPost: (success, error) => Promise.resolve(success, error),
            onPut: (success, error) => Promise.resolve(success, error),
            onPatch: (success, error) => Promise.resolve(success, error),
            onDelete: (success, error) => Promise.resolve(success, error),
            WORKER_URI_PATH: 'shared/fast'
        };
        mockFastWorkerConfig02 = {
            onStart: (success, error) => Promise.resolve(success, error),
            onStartCompleted: (success, error) => Promise.resolve(success, error),
            onGet: (success, error) => Promise.resolve(success, error),
            onPost: (success, error) => Promise.resolve(success, error),
            onPut: (success, error) => Promise.resolve(success, error),
            onPatch: (success, error) => Promise.resolve(success, error),
            onDelete: (success, error) => Promise.resolve(success, error),
            WORKER_URI_PATH: 'shared/fast'
        };
        mockFastWorker01 = sinon.stub(mockFastWorkerConfig01);
        mockFastWorker02 = sinon.stub(mockFastWorkerConfig02);
    });

    afterEach(() => {
        mockFastWorker01 = undefined;
        mockFastWorker02 = undefined;
    });

    describe('generateApp', () => {
        beforeEach(() => {
        });

        afterEach(() => {
        });

        it('generateApp with single worker and default settings',
            () => expressAdapter.generateApp([mockFastWorker01], {})
                .then((app) => {
                    assert.ok(app && app.listen);
                    assert.strictEqual(app.name, 'app');
                    assert.strictEqual(app._router.stack.filter(stack => stack.name === 'bound dispatch')[0].route.path, '/mgmt/shared/fast/*');
                    assertFastWorker(mockFastWorker01);
                }));

        it('generateApp with multiple worker and default settings',
            () => expressAdapter.generateApp([mockFastWorker01, mockFastWorker02], {})
                .then((app) => {
                    assert.ok(app && app.listen);
                    assert.strictEqual(app.name, 'app');
                    assertFastWorker(mockFastWorker01);
                    assertFastWorker(mockFastWorker02);
                }));

        it('generateApp with single worker and custom settings', () => {
            const middleware = (req, res, next) => {
                next();
            };
            http.Agent = sinon.spy();
            https.Agent = sinon.spy();
            axios.create = sinon.spy();
            return expressAdapter.generateApp([mockFastWorker01], {
                middleware: [middleware],
                staticFiles: 'test-static-file',
                bigip: {
                    username: 'test-user',
                    password: 'test-password',
                    strictCerts: false,
                    host: 'test-host.com'
                }
            })
                .then((app) => {
                    assert.ok(app && app.listen);
                    assert.strictEqual(app.name, 'app');
                    assert.ok(app._router.stack.filter(stack => stack.name === 'middleware').length);
                    assertFastWorker(mockFastWorker01);
                    assert.ok(http.Agent.called && https.Agent.called);
                    assert.ok(axios.create.called);
                    assert.deepEqual(axios.create.args[0][0], {
                        baseURL: 'test-host.com',
                        auth: {
                            username: 'test-user',
                            password: 'test-password'
                        },
                        maxBodyLength: 'Infinity',
                        httpAgent: {},
                        httpsAgent: {}
                    });
                });
        });
    });

    describe('startHttpsServer', () => {
        let testApp;
        let appArg;
        const testPort = 6443;
        let testCertKeyChain;
        let spyListenFunc;

        function assertHttpServer() {
            assert.deepEqual(testCertKeyChain, {
                cert: '-----CERTIFICATE-----',
                key: '-----PRIVATE KEY-----'
            });
            assert.ok(fs.watch.called);
            assert.ok(spyListenFunc.called);
            assert.deepEqual(testApp, appArg);
        }

        beforeEach(() => {
            mock({
                certs: mock.directory({
                    items: {
                        'certificate.pem': '-----CERTIFICATE-----',
                        'key.pem': '-----PRIVATE KEY-----'
                    }
                })
            });
            fs.watch = sinon.spy();
            spyListenFunc = sinon.spy();
            sinon.stub(https, 'createServer').callsFake((certKeyChain, app) => {
                testCertKeyChain = certKeyChain;
                appArg = app;
                return {
                    listen: spyListenFunc
                };
            });
            return expressAdapter.generateApp([mockFastWorker01], {})
                .then((app) => {
                    testApp = app;
                });
        });

        afterEach(() => {
            mock.restore();
            testCertKeyChain = undefined;
            testApp = undefined;
            spyListenFunc = undefined;
        });

        it('startHttpsServer with defaul settings', () => {
            assert.ok(testApp);
            return expressAdapter.startHttpsServer(testApp, {
                tlsKeyEnvName: 'F5_APPSVCS_SERVICE_KEY',
                tlsCertEnvName: 'F5_APPSVCS_SERVICE_CERT',
                tlsCaEnvName: 'F5_APPSVCS_SERVICE_CA',
                allowLocalCert: true,
                port: testPort
            }).then(() => {
                assertHttpServer({});
            });
        });
    });
});
