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
        let axiosCreateSpy;
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
            assert.ok(typeof fastWorker.restHelper.makeRestjavadUri === 'function');
            // validate dependencies
            assert.strictEqual(fastWorker.dependencies.length, 0);
        }

        beforeEach(() => {
            axiosCreateSpy = sinon.spy(axios, 'create');
        });

        afterEach(() => {
            axiosCreateSpy.restore();
            sinon.restore();
        });

        it('single_worker_default_settings',
            () => expressAdapter.generateApp(mockFastWorker01)
                .then((app) => {
                    assert.strictEqual(app.name, 'app');
                    assert.strictEqual(app._router.stack.filter(stack => stack.name === 'bound dispatch')[0].route.path, '/mgmt/shared/fast/*');
                    assertFastWorker(mockFastWorker01);
                }));

        it('multiple_worker_default_settings',
            () => expressAdapter.generateApp([mockFastWorker01, mockFastWorker02], {})
                .then((app) => {
                    assert.strictEqual(app.name, 'app');
                    assertFastWorker(mockFastWorker01);
                    assertFastWorker(mockFastWorker02);
                }));

        it('single_worker_custom_settings', () => {
            const middleware = (req, res, next) => {
                next();
            };
            http.Agent = sinon.spy();
            https.Agent = sinon.spy();
            return expressAdapter.generateApp(mockFastWorker01, {
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
                    assert.strictEqual(app.name, 'app');
                    assert.ok(app._router.stack.filter(stack => stack.name === 'middleware').length);
                    assertFastWorker(mockFastWorker01);
                    assert.ok(http.Agent.called && https.Agent.called);
                    assert.ok(axiosCreateSpy.called);
                    assert.ok(axiosCreateSpy.calledOnceWith({
                        baseURL: 'test-host.com',
                        auth: {
                            username: 'test-user',
                            password: 'test-password'
                        },
                        maxBodyLength: 'Infinity',
                        httpAgent: {},
                        httpsAgent: {}
                    }));
                });
        });

        it('multiple_workers_custom_settings', () => {
            const middleware = (req, res, next) => {
                next();
            };
            http.Agent = sinon.spy();
            https.Agent = sinon.spy();
            return expressAdapter.generateApp([mockFastWorker01, mockFastWorker02], {
                middleware: [middleware],
                staticFiles: 'test-static-file',
                bigip: {
                    user: 'test-user',
                    password: 'test-password',
                    strictCerts: false,
                    host: 'test-host.com'
                }
            })
                .then((app) => {
                    assert.strictEqual(app.name, 'app');
                    assert.ok(app._router.stack.filter(stack => stack.name === 'middleware').length);
                    assertFastWorker(mockFastWorker01);
                    assertFastWorker(mockFastWorker02);
                    assert.ok(http.Agent.called && https.Agent.called);
                    assert.ok(axiosCreateSpy.called);
                    assert.ok(axiosCreateSpy.calledOnceWith({
                        baseURL: 'test-host.com',
                        auth: {
                            username: 'test-user',
                            password: 'test-password'
                        },
                        maxBodyLength: 'Infinity',
                        httpAgent: {},
                        httpsAgent: {}
                    }));
                });
        });
    });

    describe('startHttpsServer', () => {
        let testApp;
        let appArg;
        let testPort;
        let testCertKeyChain;
        let spyListenFunc;
        let spyCloseFunc;
        let spySetSecureContextFunc;

        function assertHttpsServer(options) {
            const certs = {
                cert: '-----CERTIFICATE-----',
                key: '-----PRIVATE KEY-----'
            };
            if (options && options.ca) {
                certs.ca = '-----CA_CERTIFICATE-----';
            }
            assert.deepEqual(testCertKeyChain, certs);
            assert.ok(fs.watch.called);
            assert.ok(fs.watch.calledWith('certs'));
            assert.ok(spyListenFunc.called);
            assert.deepEqual(testApp, appArg);
        }

        beforeEach(() => {
            testPort = 6443;
            mock({
                certs: mock.directory({
                    items: {
                        'certificate.pem': '-----CERTIFICATE-----',
                        'key.pem': '-----PRIVATE KEY-----',
                        'ca_certificate.pem': '-----CA_CERTIFICATE-----'
                    }
                })
            });
            fs.watch = sinon.spy();
            spyListenFunc = sinon.spy();
            spySetSecureContextFunc = sinon.spy();
            spyCloseFunc = sinon.stub().resolves();
            sinon.stub(https, 'createServer').callsFake((certKeyChain, app) => {
                testCertKeyChain = certKeyChain;
                appArg = app;
                return {
                    listen: spyListenFunc,
                    close: spyCloseFunc,
                    setSecureContext: spySetSecureContextFunc
                };
            });
            return expressAdapter.generateApp(mockFastWorker01, {})
                .then((app) => {
                    testApp = app;
                });
        });

        afterEach(() => {
            sinon.restore();
            mock.restore();
            testCertKeyChain = undefined;
            testApp = undefined;
            spyListenFunc = undefined;
            spyCloseFunc = undefined;
            spySetSecureContextFunc = undefined;
            testPort = undefined;
            delete process.env.F5_SERVICE_KEY;
            delete process.env.F5_SERVICE_CERT;
            delete process.env.F5_SERVICE_CA;
        });

        it('default_settings', () => {
            assert.ok(testApp);
            return expressAdapter.startHttpsServer(testApp, {
                tlsKeyEnvName: 'F5_APPSVCS_SERVICE_KEY',
                tlsCertEnvName: 'F5_APPSVCS_SERVICE_CERT',
                tlsCaEnvName: 'F5_APPSVCS_SERVICE_CA',
                allowLocalCert: true,
                port: testPort
            }).then(() => {
                assertHttpsServer();
            });
        });

        it('custom_key_ca_cert', () => {
            assert.ok(testApp);
            process.env.F5_SERVICE_KEY = 'certs/key.pem';
            process.env.F5_SERVICE_CERT = 'certs/certificate.pem';
            process.env.F5_SERVICE_CA = 'certs/ca_certificate.pem';
            return expressAdapter.startHttpsServer(testApp, {
                tlsKeyEnvName: 'F5_SERVICE_KEY',
                tlsCertEnvName: 'F5_SERVICE_CERT',
                tlsCaEnvName: 'F5_SERVICE_CA',
                allowLocalCert: true,
                port: testPort
            }).then(() => {
                assertHttpsServer({ ca: true });
            });
        });

        it('custom_key_ca_cert_from_env_variables', () => {
            assert.ok(testApp);
            process.env.F5_SERVICE_KEY = 'certs/key.pem';
            process.env.F5_SERVICE_CERT = 'certs/certificate.pem';
            process.env.F5_SERVICE_CA = 'certs/ca_certificate.pem';
            testPort = undefined;
            return expressAdapter.startHttpsServer(testApp, {
                allowLocalCert: true,
                port: testPort
            }).then(() => {
                assertHttpsServer({ ca: true });
            });
        });

        it('failure_read_service_key', () => {
            assert.ok(testApp);
            process.env.F5_SERVICE_KEY = 'certs/key.pem';
            process.env.F5_SERVICE_CERT = 'certs/certificate.pem';
            process.env.F5_SERVICE_CA = 'certs/ca_certificate.pem';
            sinon.stub(fs, 'readFileSync').callsFake((path) => {
                if (path === process.env.F5_SERVICE_KEY) {
                    throw new Error('Failed to read service key.');
                }
            });
            return assert.rejects(expressAdapter.startHttpsServer(testApp, {
                tlsKeyEnvName: 'F5_SERVICE_KEY',
                tlsCertEnvName: 'F5_SERVICE_CERT',
                tlsCaEnvName: 'F5_SERVICE_CA',
                allowLocalCert: true,
                port: testPort
            }), {
                name: 'Error',
                message: 'Failed to load TLS key and certificate: Failed to read service key.\nFailed to read service key.'
            });
        });

        it('failure_read_service_certificate', () => {
            assert.ok(testApp);
            process.env.F5_SERVICE_KEY = 'certs/key.pem';
            process.env.F5_SERVICE_CERT = 'certs/certificate.pem';
            process.env.F5_SERVICE_CA = 'certs/ca_certificate.pem';
            sinon.stub(fs, 'readFileSync').callsFake((path) => {
                if (path === process.env.F5_SERVICE_CERT) {
                    throw new Error('Failed to read certificate.');
                }
            });
            return assert.rejects(expressAdapter.startHttpsServer(testApp, {
                tlsKeyEnvName: 'F5_SERVICE_KEY',
                tlsCertEnvName: 'F5_SERVICE_CERT',
                tlsCaEnvName: 'F5_SERVICE_CA',
                allowLocalCert: true,
                port: testPort
            }), {
                name: 'Error',
                message: 'Failed to load TLS key and certificate: Failed to read certificate.\nFailed to read certificate.'
            });
        });

        it('failure_read_service_ca_certificate', () => {
            assert.ok(testApp);
            process.env.F5_SERVICE_KEY = 'certs/key.pem';
            process.env.F5_SERVICE_CERT = 'certs/certificate.pem';
            process.env.F5_SERVICE_CA = 'certs/ca_certificate.pem';
            sinon.stub(fs, 'readFileSync').callsFake((path) => {
                if (path === process.env.F5_SERVICE_CA) {
                    throw new Error('Failed to read ca certificate.');
                }
            });
            return assert.rejects(expressAdapter.startHttpsServer(testApp, {
                tlsKeyEnvName: 'F5_SERVICE_KEY',
                tlsCertEnvName: 'F5_SERVICE_CERT',
                tlsCaEnvName: 'F5_SERVICE_CA',
                allowLocalCert: true,
                port: testPort
            }), {
                name: 'Error',
                message: 'Failed to load TLS key and certificate: Failed to read ca certificate.'
            });
        });
    });

    describe('stopHttpsServer', () => {
        let testApp;
        let testPort;
        let spyListenFunc;
        let spyCloseFunc;
        let spySetSecureContextFunc;

        beforeEach(() => {
            testPort = 6443;
            mock({
                certs: mock.directory({
                    items: {
                        'certificate.pem': '-----CERTIFICATE-----',
                        'key.pem': '-----PRIVATE KEY-----',
                        'ca_certificate.pem': '-----CA_CERTIFICATE-----'
                    }
                })
            });
            fs.watch = sinon.spy();
            spyListenFunc = sinon.spy();
            spySetSecureContextFunc = sinon.spy();
            spyCloseFunc = sinon.spy();
            sinon.stub(https, 'createServer').callsFake(() => ({
                listen: spyListenFunc,
                close: spyCloseFunc,
                setSecureContext: spySetSecureContextFunc
            }));
            return expressAdapter.generateApp(mockFastWorker01, {})
                .then(() => expressAdapter.startHttpsServer(testApp, {
                    tlsKeyEnvName: 'F5_APPSVCS_SERVICE_KEY',
                    tlsCertEnvName: 'F5_APPSVCS_SERVICE_CERT',
                    tlsCaEnvName: 'F5_APPSVCS_SERVICE_CA',
                    allowLocalCert: true,
                    port: testPort
                }))
                .then((app) => {
                    testApp = app;
                });
        });

        afterEach(() => {
            sinon.restore();
            mock.restore();
            testApp = undefined;
            spyCloseFunc = undefined;
            testPort = undefined;
            delete process.env.F5_SERVICE_KEY;
            delete process.env.F5_SERVICE_CERT;
            delete process.env.F5_SERVICE_CA;
        });

        it('default_settings', () => expressAdapter.stopHttpsServer()
            .then(() => {
                assert.ok(spyCloseFunc.called);
            }));
    });

    describe('restOpFromRequest', () => {
        it('req_with_all_availabe_properties', () => {
            const result = expressAdapter.restOpFromRequest({
                url: 'http://test-fast.com:8080/mgmt/shared/fast/',
                body: {
                    foo: 1,
                    bar: 2
                },
                headers: {
                    'Test-Header': 'This is test header value'
                }
            });
            assert.deepEqual(result.uri, {
                protocol: 'http:',
                slashes: true,
                auth: null,
                host: 'test-fast.com:8080',
                port: '8080',
                hostname: 'test-fast.com',
                hash: null,
                search: null,
                query: {},
                pathname: '/shared/fast/',
                path: '/shared/fast/',
                href: 'http://test-fast.com:8080/shared/fast/'
            });
            assert.deepEqual(result.body, {
                foo: 1,
                bar: 2
            });
            assert.strictEqual(result.headers['Test-Header'], 'This is test header value');
        });

        it('req_without_body', () => {
            const result = expressAdapter.restOpFromRequest({
                url: 'http://test-fast.com:8080/mgmt/shared/fast/',
                body: {},
                headers: {
                    'Test-Header': 'This is test header value'
                }
            });
            assert.deepEqual(result.uri, {
                protocol: 'http:',
                slashes: true,
                auth: null,
                host: 'test-fast.com:8080',
                port: '8080',
                hostname: 'test-fast.com',
                hash: null,
                search: null,
                query: {},
                pathname: '/shared/fast/',
                path: '/shared/fast/',
                href: 'http://test-fast.com:8080/shared/fast/'
            });
            assert.strictEqual(result.body, undefined);
            assert.strictEqual(result.headers['Test-Header'], 'This is test header value');
        });
    });

    describe('setResponseFromRestOp', () => {
        const mockRes = {
            set: sinon.stub(),
            status: sinon.stub().returns({
                send: sinon.stub().resolves()
            })
        };
        it('default_case', () => {
            const mockRestOp = {
                getBody: sinon.stub().returns({
                    message: 'This is test'
                }),
                getHeaders: sinon.stub().returns({
                    'Test-Header': 'Test-Value'
                }),
                getStatusCode: sinon.stub().returns(200)
            };
            expressAdapter.setResponseFromRestOp(mockRestOp, mockRes);
            assert.ok(mockRestOp.getBody.calledOnce);
            assert.ok(mockRestOp.getHeaders.calledOnce);
            assert.ok(mockRestOp.getStatusCode.calledOnce);
            assert.ok(mockRes.set.calledWith('Test-Header', 'Test-Value'));
            assert.ok(mockRes.status.calledWith(200));
        });
        it('no_body_and_no_headers_case', () => {
            const mockRestOp = {
                getBody: sinon.stub(),
                getHeaders: sinon.stub(),
                getStatusCode: sinon.stub().returns(200)
            };
            expressAdapter.setResponseFromRestOp(mockRestOp, mockRes);
            assert.ok(mockRestOp.getBody.calledOnce);
            assert.ok(mockRestOp.getHeaders.calledOnce);
            assert.ok(mockRestOp.getStatusCode.calledOnce);
            assert.ok(mockRes.status.calledWith(200));
        });
    });

    describe('getWorkerResponse', () => {
        let mockRes;
        beforeEach(() => {
            mockRes = {
                set: sinon.stub(),
                status: sinon.stub().returns({
                    send: sinon.stub().resolves()
                })
            };
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
            mockFastWorker01 = sinon.stub(mockFastWorkerConfig01);
        });

        it('get_method', () => expressAdapter.getWorkerResponse(mockFastWorker01, {
            url: 'http://test-fast.com:8080/mgmt/shared/fast/',
            body: {},
            method: 'GET',
            headers: {
                'Test-Header': 'This is test header value'
            }
        }, mockRes)
            .then(() => {
                assert.ok(mockRes.set.calledWith('Test-Header', 'This is test header value'));
                assert.ok(mockRes.status.calledWith(200));
            }));

        it('post_method', () => expressAdapter.getWorkerResponse(mockFastWorker01, {
            url: 'http://test-fast.com:8080/mgmt/shared/fast/',
            body: {
                test: 1
            },
            method: 'POST',
            headers: {
                'Test-Header': 'This is test header value'
            }
        }, mockRes)
            .then(() => {
                assert.ok(mockFastWorker01.onPost.calledOnce);
                assert.ok(mockRes.set.calledWith('Test-Header', 'This is test header value'));
                assert.ok(mockRes.status.calledWith(200));
            }));

        it('put_method', () => expressAdapter.getWorkerResponse(mockFastWorker01, {
            url: 'http://test-fast.com:8080/mgmt/shared/fast/',
            body: {
                test: 1
            },
            method: 'PUT',
            headers: {
                'Test-Header': 'This is test header value'
            }
        }, mockRes)
            .then(() => {
                assert.ok(mockFastWorker01.onPut.calledOnce);
                assert.ok(mockRes.set.calledWith('Test-Header', 'This is test header value'));
                assert.ok(mockRes.status.calledWith(200));
            }));

        it('patch_method', () => expressAdapter.getWorkerResponse(mockFastWorker01, {
            url: 'http://test-fast.com:8080/mgmt/shared/fast/',
            body: {
                test: 1
            },
            method: 'PATCH',
            headers: {
                'Test-Header': 'This is test header value'
            }
        }, mockRes)
            .then(() => {
                assert.ok(mockFastWorker01.onPatch.calledOnce);
                assert.ok(mockRes.set.calledWith('Test-Header', 'This is test header value'));
                assert.ok(mockRes.status.calledWith(200));
            }));

        it('delete_method', () => expressAdapter.getWorkerResponse(mockFastWorker01, {
            url: 'http://test-fast.com:8080/mgmt/shared/fast/',
            body: {
                test: 1
            },
            method: 'DELETE',
            headers: {
                'Test-Header': 'This is test header value'
            }
        }, mockRes)
            .then(() => {
                assert.ok(mockFastWorker01.onDelete.calledOnce);
                assert.ok(mockRes.set.calledWith('Test-Header', 'This is test header value'));
                assert.ok(mockRes.status.calledWith(200));
            }));

        it('invalid_method_case', () => expressAdapter.getWorkerResponse(mockFastWorker01, {
            url: 'http://test-fast.com:8080/mgmt/shared/fast/',
            body: {
                test: 1
            },
            method: 'INVALID_METHOD_NAME',
            headers: {
                'Test-Header': 'This is test header value'
            }
        }, mockRes).then(() => {
            assert.ok(mockFastWorker01.onDelete.notCalled);
            assert.ok(mockFastWorker01.onGet.notCalled);
            assert.ok(mockFastWorker01.onPost.notCalled);
            assert.ok(mockFastWorker01.onPut.notCalled);
            assert.ok(mockFastWorker01.onPatch.notCalled);
        }));
    });
});
