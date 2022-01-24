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

const path = require('path');
const url = require('url');

const fs = require('fs');
const assert = require('assert').strict;
const nock = require('nock');
const sinon = require('sinon');
const chai = require('chai');

const expect = chai.expect;
const chaiResponseValidator = require('chai-openapi-response-validator').default;

chai.use(chaiResponseValidator(path.join(__dirname, '../../docs/openapi.yml')));

const fast = require('@f5devcentral/f5-fast-core');
const atgStorage = require('@f5devcentral/atg-storage');

const AS3DriverConstantsKey = require('../../lib/drivers').AS3DriverConstantsKey;
const { SecretsBase64 } = require('../../lib/secrets');

const FASTWorker = require('../../nodejs/fastWorker');
const IpamProviders = require('../../lib/ipam');

const templatesPath = path.join(process.cwd(), 'templates');

class RestOp {
    constructor(uri) {
        this.uri = uri;
        this.body = '';
        this.status = 200;
        this.headers = { 'content-type': 'application/json' };
    }

    setHeaders() {}

    getHeader(name) {
        return this.headers[name];
    }

    getContentType() {
        return this.headers['content-type'];
    }

    setStatusCode(status) {
        this.status = status;
    }

    getStatusCode() {
        return this.status;
    }

    setBody(body) {
        this.body = body;
    }

    getBody() {
        return this.body;
    }

    setUri(uri) {
        this.uri = uri;
    }

    getUri() {
        const uri = url.parse(`/a/b/${this.uri}`);
        if (uri.query) {
            uri.query = uri.query
                .split('&')
                .reduce((acc, curr) => {
                    const [key, value] = curr.split('=');
                    acc[key] = value;
                    return acc;
                }, {});
        } else {
            uri.query = {};
        }
        return uri;
    }

    getMethod() {
        return '';
    }

    setMethod() {
    }
}

// Update worker instance to mimic iControl LX environment
const patchWorker = (worker) => {
    worker.logger = {
        severe: (str) => {
            console.log(str);
            assert(false, 'worker hit a severe error');
        },
        error: console.log,
        info: console.log,
        fine: console.log,
        log: console.log
    };
    worker.ipamProviders = new IpamProviders({
        secretsManager: worker.secretsManager,
        logger: worker.logger,
        transactionLogger: worker.transactionLogger
    });
    worker.setDeviceInfo();
    worker.completedRestOp = false;
    worker.completeRestOperation = function (op) {
        console.log('Completed REST Operation:');
        console.log(JSON.stringify(op, null, 2));
        this.completedRestOp = true;
    };
    const ensureCompletedOp = (fn) => {
        worker[`_${fn}`] = worker[fn];
        worker[fn] = function (op) {
            this.completedRestOp = false;
            return this[`_${fn}`](op)
                .then(() => {
                    if (!this.completedRestOp) {
                        throw new Error(`failed to call completeRestOperation() in ${fn}()`);
                    }
                });
        };
    };
    ensureCompletedOp('onGet');
    ensureCompletedOp('onPost');
    ensureCompletedOp('onDelete');
    ensureCompletedOp('onPatch');
};

let testStorage = null;

class TeemDeviceMock {
    report(reportName, reportVersion, declaration, extraFields) {
        // console.error(`${reportName}: ${JSON.stringify(extraFields)}`);
        return Promise.resolve()
            .then(() => {
                assert(reportName);
                assert(declaration);
                assert(extraFields);
            });
    }
}

function copyStorage(src) {
    return new atgStorage.StorageMemory(Object.assign({}, src.data));
}

function createWorker() {
    const worker = new FASTWorker({
        templateStorage: copyStorage(testStorage),
        configStorage: new atgStorage.StorageMemory(),
        secretsManager: new SecretsBase64(),
        fsTemplateList: [
            'examples',
            'bigip-fast-templates'
        ],
        configPath: process.cwd(),
        templatesPath,
        uploadPath: './test/unit/mockDir'
    });
    patchWorker(worker);

    worker.teemDevice = new TeemDeviceMock();

    worker.hookCompleteRestOp();
    return worker;
}

function resetScope(scope) {
    scope.persist(false);
    scope.interceptors.forEach(nock.removeInterceptor);
    return scope;
}

describe('fastWorker tests', function () {
    this.timeout(3000);
    const host = 'http://localhost:8100';
    const as3ep = '/mgmt/shared/appsvcs/declare';
    const as3TaskEp = '/mgmt/shared/appsvcs/task';
    const as3stub = {
        class: 'ADC',
        schemaVersion: '3.0.0'
    };
    const as3App = {
        class: 'Application',
        constants: {
            [AS3DriverConstantsKey]: {
                template: 'foo/bar'
            }
        }
    };
    let as3Scope;

    before(function () {
        const tsNames = [
            'bigip-fast-templates',
            'examples'
        ];
        testStorage = new atgStorage.StorageMemory();
        return fast.DataStoreTemplateProvider.fromFs(testStorage, templatesPath, tsNames);
    });

    beforeEach(function () {
        this.clock = sinon.useFakeTimers();

        nock(host)
            .persist()
            .get('/mgmt/tm/sys/provision')
            .reply(200, {
                kind: 'tm:sys:provision:provisioncollectionstate',
                selfLink: 'https://localhost/mgmt/tm/sys/provision?ver=15.0.1.1',
                items: [
                    {
                        kind: 'tm:sys:provision:provisionstate',
                        name: 'afm',
                        fullPath: 'afm',
                        generation: 1,
                        selfLink: 'https://localhost/mgmt/tm/sys/provision/afm?ver=15.0.1.1',
                        cpuRatio: 0,
                        diskRatio: 0,
                        level: 'none',
                        memoryRatio: 0
                    },
                    {
                        kind: 'tm:sys:provision:provisionstate',
                        name: 'asm',
                        fullPath: 'asm',
                        generation: 1,
                        selfLink: 'https://localhost/mgmt/tm/sys/provision/asm?ver=15.0.1.1',
                        cpuRatio: 0,
                        diskRatio: 0,
                        level: 'nominal',
                        memoryRatio: 0
                    }
                ]
            });

        nock(host)
            .persist()
            .get('/mgmt/shared/telemetry/info')
            .reply(200, {
            });

        nock(host)
            .persist()
            .get('/mgmt/shared/identified-devices/config/device-info')
            .reply(200, {
                platform: 'Z100',
                machineId: 'some-guid',
                hostname: 'fast.unit.test.host',
                version: '13.1.1.4',
                product: 'BIG-IP',
                platformMarketingName: 'BIG-IP Virtual Edition',
                edition: 'Engineering Hotfix',
                build: '0.140.4',
                restFrameworkVersion: '13.1.1.4-0.0.4',
                kind: 'shared:resolver:device-groups:deviceinfostate',
                selfLink: 'https://localhost/mgmt/shared/identified-devices/config/device-info'
            });

        nock(host)
            .persist()
            .get('/mgmt/shared/appsvcs/info')
            .reply(200, {
                version: '3.16'
            });

        as3Scope = nock(host)
            .persist()
            .get(as3ep)
            .query(true)
            .reply(200, Object.assign({}, as3stub, {
                tenant: {
                    class: 'Tenant',
                    app: as3App
                }
            }));
    });

    afterEach(function () {
        nock.cleanAll();
        this.clock.restore();

        const scratchPath = path.join(process.cwd(), 'scratch');
        if (fs.existsSync(scratchPath)) {
            fs.rmdirSync(scratchPath, { recursive: true });
        }
    });

    after(() => {
        delete process.env.FAST_UPLOAD_DIR;
    });

    describe('worker methods', function () {
        it('on_start', function () {
            const worker = createWorker();

            // Clear the data store
            worker.storage.data = {};

            nock(host)
                .persist()
                .post(`${as3ep}/Common?async=true`)
                .reply(202, {});

            const scope = nock(host)
                .get('/mgmt/shared/iapp/blocks')
                .reply(200, { items: [] })
                .post('/mgmt/shared/iapp/blocks')
                .reply(200, {});

            return worker.onStart(
                () => {}, // success callback
                () => assert(false) // error callback
            )
                .then(() => assert(scope.isDone(), 'iApps block storage endpoint was not accessed'))
                .then(() => worker.templateProvider.list())
                .then((tmplList) => {
                    assert(tmplList.includes('examples/simple_http'));
                })
                .then(() => {
                    assert.deepStrictEqual(worker.deviceInfo, {
                        build: '0.140.4',
                        edition: 'Engineering Hotfix',
                        fullVersion: '13.1.1.4-0.140.4',
                        hostname: 'fast.unit.test.host',
                        platform: 'Z100',
                        platformName: 'BIG-IP Virtual Edition',
                        product: 'BIG-IP',
                        version: '13.1.1.4'
                    }, 'device info should be set');
                });
        });
        it('onStartCompleted', function () {
            const worker = createWorker();
            nock(host)
                .get('/mgmt/shared/appsvcs/info')
                .reply(200, {});
            return Promise.resolve()
                .then(() => worker.onStartCompleted(
                    () => {}, // success callback
                    () => assert(false), // error callback
                    undefined,
                    ''
                ));
        });
        it('hydrateSchema', function () {
            const worker = createWorker();
            worker.configStorage.data.config = {
                ipamProviders: [
                    { name: 'bar' }
                ]
            };

            const inputSchema = {
                properties: {
                    foo: {
                        type: 'string',
                        enumFromBigip: 'ltm/profile/http-compression'
                    },
                    fooItems: {
                        type: 'array',
                        items: {
                            type: 'string',
                            enumFromBigip: 'ltm/profile/http-compression'
                        }
                    },
                    multipleEndpoints: {
                        type: 'string',
                        enumFromBigip: [
                            'ltm/profile/http-compression',
                            'ltm/profile/http-compression2'
                        ]
                    },
                    fooIpam: {
                        type: 'string',
                        ipFromIpam: true
                    },
                    fooIpamItems: {
                        type: 'array',
                        items: {
                            type: 'string',
                            ipFromIpam: true
                        }
                    }
                }
            };
            nock(host)
                .persist()
                .get('/mgmt/tm/ltm/profile/http-compression?$select=fullPath')
                .reply(200, {
                    kind: 'tm:ltm:profile:http-compression:http-compressioncollectionstate',
                    selfLink: 'https://localhost/mgmt/tm/ltm/profile/http-compression?$select=fullPath&ver=15.0.1.1',
                    items: [
                        { fullPath: '/Common/httpcompression' },
                        { fullPath: '/Common/wan-optimized-compression' }
                    ]
                })
                .get('/mgmt/tm/ltm/profile/http-compression2?$select=fullPath')
                .reply(200, {
                    kind: 'tm:ltm:profile:http-compression:http-compressioncollectionstate',
                    selfLink: 'https://localhost/mgmt/tm/ltm/profile/http-compression2?$select=fullPath&ver=15.0.1.1',
                    items: [
                        { fullPath: '/Common/httpcompression2' },
                        { fullPath: '/Common/wan-optimized-compression2' }
                    ]
                });

            const tmpl = {
                _parametersSchema: inputSchema
            };
            return worker.hydrateSchema(tmpl, 0)
                .then((schema) => {
                    console.log(schema);
                    assert.deepEqual(schema.properties.foo.enum, [
                        '/Common/httpcompression',
                        '/Common/wan-optimized-compression'
                    ]);
                    assert.deepEqual(schema.properties.fooItems.items.enum, [
                        '/Common/httpcompression',
                        '/Common/wan-optimized-compression'
                    ]);
                    assert.deepEqual(schema.properties.multipleEndpoints.enum, [
                        '/Common/httpcompression',
                        '/Common/wan-optimized-compression',
                        '/Common/httpcompression2',
                        '/Common/wan-optimized-compression2'
                    ]);
                    assert.deepEqual(schema.properties.fooIpam.enum, [
                        'bar'
                    ]);
                    assert.deepEqual(schema.properties.fooIpamItems.items.enum, [
                        'bar'
                    ]);
                });
        });
        it('bigipDependencies', function () {
            const worker = createWorker();

            const checkTmplDeps = (yamltext) => {
                let retTmpl;
                return Promise.resolve()
                    .then(() => fast.Template.loadYaml(yamltext))
                    .then((tmpl) => {
                        retTmpl = tmpl;
                        return tmpl;
                    })
                    .then(tmpl => worker.checkDependencies(tmpl, 0))
                    .then(() => retTmpl);
            };

            return Promise.resolve()
                .then(() => checkTmplDeps(`
                    title: root simple pass
                    bigipDependencies:
                        - asm
                    template: |
                        Some text
                `))
                .catch(e => assert(false, e.message))
                .then(() => checkTmplDeps(`
                    title: root simple fail
                    bigipDependencies:
                        - cgnat
                    template: |
                        Some text
                `))
                .then(() => assert(false, 'expected template to fail'))
                .catch(e => assert.match(e.message, /missing modules: cgnat/))
                .then(() => checkTmplDeps(`
                    title: root anyOf
                    anyOf:
                        - {}
                        - title: asm
                          bigipDependencies: [asm]
                          template: foo
                        - title: cgnat
                          bigipDependencies: [cgnat]
                          template: bar
                    template: |
                        Some text
                `))
                .then((tmpl) => {
                    assert.strictEqual(tmpl._anyOf.length, 2);
                    assert.strictEqual(tmpl._anyOf[1].title, 'asm');
                })
                .then(() => checkTmplDeps(`
                    title: root allOf
                    allOf:
                        - title: cgnat
                          bigipDependencies: [cgnat]
                          template: bar
                    template: |
                        Some text
                `))
                .then(() => assert(false, 'expected template to fail'))
                .catch(e => assert.match(e.message, /missing modules: cgnat/))
                .then(() => checkTmplDeps(`
                    title: root oneOf fail
                    oneOf:
                        - title: cgnat
                          bigipDependencies: [cgnat]
                          template: bar
                    template: |
                        Some text
                `))
                .then(() => assert(false, 'expected template to fail'))
                .catch(e => assert.match(e.message, /no single oneOf had valid/))
                .then(() => checkTmplDeps(`
                    title: root oneOf pass
                    oneOf:
                        - title: cgnat
                          bigipDependencies: [cgnat]
                          template: bar
                        - title: asm
                          bigipDependencies: [asm]
                          template: foo
                    template: |
                        Some text
                `))
                .then((tmpl) => {
                    assert.strictEqual(tmpl._oneOf.length, 1);
                    assert.strictEqual(tmpl._oneOf[0].title, 'asm');
                });
        });
        it('as3_version_check', function () {
            const worker = createWorker();

            const checkVersion = (yamltext) => {
                let retTmpl;
                return Promise.resolve()
                    .then(() => fast.Template.loadYaml(yamltext))
                    .then((tmpl) => {
                        retTmpl = tmpl;
                        return tmpl;
                    })
                    .then(tmpl => worker.checkDependencies(tmpl, 0))
                    .then(() => retTmpl);
            };

            return Promise.resolve()
                .then(() => checkVersion(`
                    title: no version
                    template: text
                `))
                .catch(e => assert(false, e.stack))
                .then(() => checkVersion(`
                    title: version met
                    bigipMinimumAS3: 3.16.0
                    template: text
                `))
                .catch(e => assert(false, e.stack))
                .then(() => checkVersion(`
                    title: version not met
                    bigipMinimumAS3: 3.23
                    template: text
                `))
                .then(() => assert(false, 'expected template to fail'))
                .catch(e => assert.match(e.message, /since it requires AS3 >= 3.23/));
        });
        it('bigip_version_check', function () {
            const worker = createWorker();

            const checkBigipVersion = (yamltext) => {
                let retTmpl;
                return Promise.resolve()
                    .then(() => fast.Template.loadYaml(yamltext))
                    .then((tmpl) => {
                        retTmpl = tmpl;
                        return tmpl;
                    })
                    .then(tmpl => worker.checkDependencies(tmpl, 0))
                    .then(() => retTmpl);
            };

            return Promise.resolve()
                .then(() => checkBigipVersion(`
                    title: no version
                    template: text
                `))
                .catch(e => assert(false, e.stack))
                .then(() => checkBigipVersion(`
                    title: min version met
                    bigipMinimumVersion: 13.1
                    template: text
                `))
                .catch(e => assert(false, e.stack))
                .then(() => checkBigipVersion(`
                    title: min version not met
                    bigipMinimumVersion: 16.3
                    template: text
                `))
                .then(() => assert(false, 'expected template to fail'))
                .catch(e => assert.match(e.message, /since it requires BIG-IP >= 16.3/))
                .then(() => checkBigipVersion(`
                    title: max version met
                    bigipMaximumVersion: 16.3
                    template: text
                `))
                .catch(e => assert(false, e.stack))
                .then(() => checkBigipVersion(`
                    title: max version not met
                    bigipMaximumVersion: 13.1
                    template: text
                `))
                .then(() => assert(false, 'expected template to fail'))
                .catch(e => assert.match(e.message, /since it requires BIG-IP maximum version of 13.1/))
                .then(() => checkBigipVersion(`
                    title: min and version met
                    bigipMinimumVersion: 13.1
                    bigipMaximumVersion: 16.3
                    template: text
                `))
                .catch(e => assert(false, e.stack));
        });
        it('max_bigip_version_check', function () {
            const worker = createWorker();

            const checkBigipVersion = (yamltext) => {
                let retTmpl;
                return Promise.resolve()
                    .then(() => fast.Template.loadYaml(yamltext))
                    .then((tmpl) => {
                        retTmpl = tmpl;
                        return tmpl;
                    })
                    .then(tmpl => worker.checkDependencies(tmpl, 0))
                    .then(() => retTmpl);
            };

            return Promise.resolve()
                .then(() => checkBigipVersion(`
                    title: no version
                    template: text
                `))
                .catch(e => assert(false, e.stack))
                .then(() => checkBigipVersion(`
                    title: version met
                    bigipMinimumVersion: 13.1
                    template: text
                `))
                .catch(e => assert(false, e.stack))
                .then(() => checkBigipVersion(`
                    title: version not met
                    bigipMinimumVersion: 16.3
                    template: text
                `))
                .then(() => assert(false, 'expected template to fail'))
                .catch(e => assert.match(e.message, /since it requires BIG-IP >= /));
        });
    });

    describe('settings', function () {
        it('post_settings', function () {
            const worker = createWorker();
            const op = new RestOp('settings');
            op.setBody({
                deletedTemplateSets: [
                    'foo'
                ],
                enableIpam: true,
                ipamProviders: [
                    { name: 'test', password: 'foobar', serviceType: 'Generic' }
                ]
            });
            return worker.onPost(op)
                .then(() => {
                    console.log(JSON.stringify(op.body, null, 2));
                    assert.equal(op.status, 200);
                    expect(op.body).to.satisfySchemaInApiSpec('Settings');
                })
                .then(() => worker.getConfig(0))
                .then((config) => {
                    assert.deepStrictEqual(config.deletedTemplateSets, ['foo']);
                    assert(config.ipamProviders[0].password !== 'foobar', 'IPAM password was not encrypted');
                });
        });
        it('post_settings_bad', function () {
            const worker = createWorker();
            const op = new RestOp('settings');
            op.setBody({
            });
            return worker.onPost(op)
                .then(() => {
                    console.log(JSON.stringify(op.body, null, 2));
                    assert.equal(op.status, 422);
                });
        });
        it('patch_settings', function () {
            const worker = createWorker();
            const op = new RestOp('settings');
            op.setBody({
                deletedTemplateSets: [
                    'foo'
                ],
                enableIpam: true,
                ipamProviders: [
                    { name: 'test', password: 'foobar', serviceType: 'Generic' }
                ]
            });
            return worker.onPatch(op)
                .then(() => {
                    console.log(JSON.stringify(op.body, null, 2));
                    assert.equal(op.status, 200);
                })
                .then(() => worker.getConfig(0))
                .then((config) => {
                    assert.deepStrictEqual(config.deletedTemplateSets, ['foo']);
                    assert(config.ipamProviders[0].password !== 'foobar', 'IPAM password was not encrypted');
                });
        });
        it('patch_settings_bad', function () {
            const worker = createWorker();
            const op = new RestOp('settings');
            op.setBody({
                deletedTemplateSets: 5
            });
            return worker.onPatch(op)
                .then(() => {
                    console.log(JSON.stringify(op.body, null, 2));
                    assert.equal(op.status, 422);
                });
        });
        it('get_settings_schema', function () {
            const worker = createWorker();
            const op = new RestOp('settings-schema');

            return worker.onGet(op)
                .then(() => {
                    assert.strictEqual(op.status, 200);

                    const configSchema = op.getBody();
                    console.log(JSON.stringify(configSchema, null, 2));
                    expect(configSchema).to.satisfySchemaInApiSpec('SettingsSchema');
                    assert.deepStrictEqual(configSchema.properties.deletedTemplateSets, {
                        type: 'array',
                        items: {
                            type: 'string'
                        },
                        uniqueItems: true,
                        options: {
                            hidden: true
                        },
                        // addtl props for JSONEditor
                        propertyOrder: 0,
                        format: 'table'
                    });
                });
        });
        it('get_settings', function () {
            const worker = createWorker();
            const op = new RestOp('settings');

            return worker.onGet(op)
                .then(() => {
                    assert.strictEqual(op.status, 200);

                    const config = op.getBody();
                    console.log(JSON.stringify(config, null, 2));
                    assert.ok(config.deletedTemplateSets);
                    expect(config).to.satisfySchemaInApiSpec('Settings');
                });
        });
        it('delete_settings', function () {
            const worker = createWorker();
            const op = new RestOp('settings');

            return worker.getConfig(0)
                .then((config) => {
                    config.foo = 'bar';
                })
                .then(() => worker.onGet(op))
                .then(() => {
                    assert.strictEqual(op.status, 200);
                    console.log(JSON.stringify(op.body, null, 2));
                    assert.ok(op.body.foo);
                })
                .then(() => worker.onDelete(op))
                .then(() => {
                    assert.strictEqual(op.status, 200);
                    console.log(JSON.stringify(op.body, null, 2));
                    assert.strictEqual(op.body.foo, undefined);
                });
        });
    });

    describe('info', function () {
        it('get_info', function () {
            const worker = createWorker();
            const op = new RestOp('info');
            nock(host)
                .get('/mgmt/shared/appsvcs/info')
                .reply(200, {});

            return worker.onGet(op)
                .then(() => {
                    const info = op.body;
                    assert.strictEqual(op.status, 200);
                    console.log(JSON.stringify(info, null, 2));
                    assert.notEqual(info.installedTemplates, []);

                    const tsNames = info.installedTemplates.map(x => x.name);
                    assert(tsNames.includes('bigip-fast-templates'));
                    assert(tsNames.includes('examples'));

                    const exampleTS = info.installedTemplates.filter(
                        x => x.name === 'examples'
                    )[0];
                    assert(!exampleTS.supported, `${exampleTS.name} should not be marked as officially supported`);
                    assert(exampleTS.enabled, `${exampleTS.name} should be marked as enabled`);
                    // assert(!exampleTS.updateAvailable, `${exampleTS.name} should not have an update available`);

                    const bigipTS = info.installedTemplates.filter(
                        x => x.name === 'bigip-fast-templates'
                    )[0];
                    assert(bigipTS.supported, `${bigipTS.name} has an unsupported hash: ${bigipTS.hash}`);
                    assert(bigipTS.enabled, `${bigipTS.name} should be marked as enabled`);
                    // assert(!bigipTS.updateAvailable, `${bigipTS.name} should not have an update available`);

                    const config = info.config;
                    assert.ok(config);
                    assert.ok(config.deletedTemplateSets);
                    expect(info).to.satisfySchemaInApiSpec('Info');
                });
        });
        it('get_info_without_as3', function () {
            const worker = createWorker();
            const op = new RestOp('info');
            nock(host)
                .get('/mgmt/shared/appsvcs/info')
                .reply(404);

            return worker.onGet(op)
                .then(() => {
                    const info = op.body;
                    assert.strictEqual(op.status, 200);
                    console.log(JSON.stringify(info, null, 2));
                    assert.notEqual(info.installedTemplates, []);

                    const tsNames = info.installedTemplates.map(x => x.name);
                    assert(tsNames.includes('bigip-fast-templates'));
                    assert(tsNames.includes('examples'));
                    expect(info).to.satisfySchemaInApiSpec('Info');
                });
        });
    });

    describe('tasks', function () {
        it('get_tasks', function () {
            const worker = createWorker();
            const op = new RestOp('tasks');
            worker.driver._task_ids.foo1 = `${AS3DriverConstantsKey}-update-tenant-app-0-0-0-0-0`;
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
                        }
                    ]
                });
            return worker.onGet(op)
                .then(() => {
                    assert.notEqual(op.status, 404);
                    assert.notEqual(op.status, 500);
                    assert.deepEqual(op.body, [{
                        application: 'app',
                        id: 'foo1',
                        code: 200,
                        message: 'in progress',
                        name: '',
                        parameters: {},
                        tenant: 'tenant',
                        operation: 'update',
                        timestamp: new Date().toISOString(),
                        host: 'localhost'
                    }]);
                    expect(op.body).to.satisfySchemaInApiSpec('TaskList');
                });
        });
        it('get_tasks_item', function () {
            const worker = createWorker();
            const op = new RestOp('tasks/foo1');
            worker.driver._task_ids.foo1 = `${AS3DriverConstantsKey}-update-tenant-app-0-0-0-0-0`;
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
                        }
                    ]
                });
            return worker.onGet(op)
                .then(() => {
                    assert.notEqual(op.status, 404);
                    assert.notEqual(op.status, 500);
                    assert.deepEqual(op.body, {
                        application: 'app',
                        id: 'foo1',
                        code: 200,
                        message: 'in progress',
                        name: '',
                        parameters: {},
                        tenant: 'tenant',
                        operation: 'update',
                        timestamp: new Date().toISOString(),
                        host: 'localhost'
                    });
                    expect(op.body).to.satisfySchemaInApiSpec('Task');
                });
        });
        it('get_tasks_bad', function () {
            const worker = createWorker();
            const op = new RestOp('tasks/foo1');
            nock(host)
                .get(as3TaskEp)
                .reply(200, {
                    items: [
                    ]
                });
            return worker.onGet(op)
                .then(() => {
                    assert.strictEqual(op.status, 404);
                });
        });
    });

    describe('render', function () {
        it('post_render', function () {
            const worker = createWorker();
            const op = new RestOp('render');
            op.setBody({
                name: 'examples/simple_udp_defaults',
                parameters: {}
            });
            return worker.onPost(op)
                .then(() => {
                    console.log(JSON.stringify(op.body, null, 3));
                    assert.equal(op.status, 200);
                    assert(Array.isArray(op.body.message));
                });
        });
        it('post_render_bad_tmplid', function () {
            const worker = createWorker();
            const op = new RestOp('render');
            op.setBody({
                name: 'foobar/does_not_exist',
                parameters: {}
            });
            return worker.onPost(op)
                .then(() => {
                    assert.equal(op.status, 404);
                    assert.match(op.body.message, /Could not find template/);
                });
        });
        it('post_render_bad_params', function () {
            const worker = createWorker();
            const op = new RestOp('render');
            op.setBody({
                name: 'examples/simple_udp_defaults',
                parameters: {
                    virtual_port: 'foobar'
                }
            });
            return worker.onPost(op)
                .then(() => {
                    console.log(JSON.stringify(op.body, null, 2));
                    assert.equal(op.status, 400);
                    assert.match(op.body.message, /Parameters failed validation/);
                });
        });
        it('post_render_bad_properties', function () {
            const worker = createWorker();
            const op = new RestOp('render');
            op.setBody({
            });

            return worker.onPost(op)
                .then(() => {
                    console.log(JSON.stringify(op.body, null, 2));
                    assert.equal(op.status, 400);
                    assert.match(op.body.message, /name property is missing/);
                })
                .then(() => op.setBody({
                    name: 'examples/simple_udp_defaults'
                }))
                .then(() => worker.onPost(op))
                .then(() => {
                    console.log(JSON.stringify(op.body, null, 2));
                    assert.equal(op.status, 400);
                    assert.match(op.body.message, /parameters property is missing/);
                });
        });
    });

    describe('templates', function () {
        it('get_templates', function () {
            const worker = createWorker();
            const op = new RestOp('templates');
            return worker.onGet(op)
                .then(() => {
                    const templates = op.body;
                    assert.notEqual(op.status, 404);
                    assert.notEqual(templates.length, 0);
                    expect(templates).to.satisfySchemaInApiSpec('TemplateList');
                });
        });
        it('get_template_bad', function () {
            const worker = createWorker();
            const op = new RestOp('templates/foobar');
            return worker.onGet(op)
                .then(() => {
                    assert.equal(op.status, 404);
                });
        });
        it('get_template_item', function () {
            const worker = createWorker();
            const op = new RestOp('templates/examples/simple_udp');
            return worker.onGet(op)
                .then(() => {
                    const tmpl = op.body;
                    console.log(op.body.message);
                    assert.strictEqual(op.status, 200);
                    assert.notEqual(tmpl, {});
                    expect(tmpl).to.satisfySchemaInApiSpec('Template');
                });
        });
        it('get_template_ipam', function () {
            const worker = createWorker();
            const op = new RestOp('templates/bigip-fast-templates/dns');

            worker.configStorage.data.config = {
                enableIpam: false
            };

            nock(host)
                .persist()
                .get(/\/mgmt\/tm\/.*/)
                .reply(200, {
                    items: []
                });
            return Promise.resolve()
                // IPAM disabled
                .then(() => worker.onGet(op))
                .then(() => {
                    assert.strictEqual(op.status, 200);
                    return fast.Template.fromJson(op.body);
                })
                .then((tmpl) => {
                    const schema = fast.guiUtils.modSchemaForJSONEditor(tmpl.getParametersSchema());
                    const props = schema.properties;

                    assert.strictEqual(
                        props.use_ipam,
                        undefined,
                        'use_ipam is still available when IPAM is disabled'
                    );
                    assert.strictEqual(
                        props.virtual_address_ipam,
                        undefined,
                        'virtual_address_ipam is still available when IPAM is disabled'
                    );
                })
                // IPAM enabled
                .then(() => {
                    worker.configStorage.data.config.enableIpam = true;
                })
                .then(() => worker.onGet(op))
                .then(() => {
                    assert.strictEqual(op.status, 200);
                    return fast.Template.fromJson(op.body);
                })
                .then((tmpl) => {
                    const schema = fast.guiUtils.modSchemaForJSONEditor(tmpl.getParametersSchema());
                    const props = schema.properties;

                    assert.ok(
                        props.use_ipam,
                        'use_ipam is not available when IPAM is enabled'
                    );
                    assert.ok(
                        props.virtual_address_ipam,
                        'virtual_address_ipam is not available when IPAM is enabled'
                    );
                });
        });
        it('get_template_item_with_schema', function () {
            const worker = createWorker();
            const op = new RestOp('templates/bigip-fast-templates/http');
            nock(host)
                .persist()
                .get(/mgmt\/tm\/.*/)
                .reply(200, {
                    kind: 'tm:ltm:profile:http-compression:http-compressioncollectionstate',
                    selfLink: 'https://localhost/mgmt/tm/ltm/profile/http-compression?$select=fullPath&ver=15.0.1.1',
                    items: [
                        { fullPath: '/Common/httpcompression' },
                        { fullPath: '/Common/wan-optimized-compression' }
                    ]
                });
            return worker.onGet(op)
                .then(() => {
                    const tmpl = op.body;
                    assert.equal(op.status, 200);
                    assert.notEqual(tmpl, {});
                    assert.notEqual(tmpl.getParametersSchema(), {});
                });
        });
    });

    describe('templatesets', function () {
        it('get_templatesets', function () {
            const worker = createWorker();
            const op = new RestOp('templatesets');
            return worker.onGet(op)
                .then(() => {
                    assert.notEqual(op.status, 404);
                    assert.notEqual(op.status, 500);

                    const foundSets = op.body.map(x => x.name);
                    assert(foundSets.includes('bigip-fast-templates'));
                    assert(foundSets.includes('examples'));
                    expect(op.body).to.satisfySchemaInApiSpec('TemplateSetList');
                });
        });
        it('get_templatesets_item', function () {
            const worker = createWorker();
            const op = new RestOp('templatesets/bigip-fast-templates');
            return worker.onGet(op)
                .then(() => {
                    assert.notEqual(op.status, 404);
                    assert.notEqual(op.status, 500);

                    const ts = op.body;
                    assert.notDeepEqual(ts, {});
                    assert.strictEqual(ts.name, 'bigip-fast-templates');
                    assert.notDeepEqual(ts.templates, []);
                    expect(ts).to.satisfySchemaInApiSpec('TemplateSet');
                });
        });
        it('get_templatesets_bad', function () {
            const worker = createWorker();
            const op = new RestOp('templatesets/foo1');
            return worker.onGet(op)
                .then(() => {
                    assert.strictEqual(op.status, 404);
                });
        });
        // run settings and templatesets last as they can interfere with the other tests
        it('post_templateset_missing', function () {
            const worker = createWorker();
            const op = new RestOp('templatesets');
            op.setBody({
                name: 'badname'
            });

            return worker.onPost(op)
                .then(() => assert.equal(op.status, 404))
                .then(() => {
                    op.setBody({});
                    return worker.onPost(op);
                })
                .then(() => assert.equal(op.status, 400));
        });
        it('post_templateset', function () {
            const worker = createWorker();
            const op = new RestOp('templatesets');
            const infoOp = new RestOp('info');

            this.clock.restore();

            op.setBody({
                name: 'testset'
            });

            nock(host)
                .get('/mgmt/shared/appsvcs/info')
                .reply(404);

            return worker.onPost(op)
                .then(() => {
                    assert.equal(op.status, 200);
                })
                .then(() => worker.templateProvider.listSets())
                .then((tmplSets) => {
                    assert(fs.existsSync(path.join(process.cwd(), 'scratch')));
                    assert(tmplSets.includes('testset'));
                })
                .then(() => worker.onGet(infoOp))
                .then(() => {
                    assert.strictEqual(infoOp.status, 200);

                    const tsNames = infoOp.body.installedTemplates.map(x => x.name);
                    assert(tsNames.includes('testset'));
                });
        });
        it('post_templateset_deleted', function () {
            const worker = createWorker();
            const op = new RestOp('templatesets');
            const getTsOp = new RestOp('templatesets?showDisabled=true');

            op.setBody({
                name: 'examples'
            });
            worker.storage.deleteItem('examples');
            worker.configStorage.data = {
                config: {
                    deletedTemplateSets: ['examples']
                }
            };

            const objFromSets = setList => setList.reduce((acc, curr) => {
                acc[curr.name] = curr;
                return acc;
            }, {});

            return worker.onGet(getTsOp)
                .then(() => {
                    assert.equal(getTsOp.status, 200);
                    console.log(JSON.stringify(getTsOp.body, null, 2));

                    const sets = objFromSets(getTsOp.body);
                    assert.equal(sets.examples.enabled, false);
                })
                .then(() => worker.onPost(op))
                .then(() => {
                    assert.equal(op.status, 200);
                })
                .then(() => worker.onGet(getTsOp))
                .then(() => {
                    assert.equal(getTsOp.status, 200);
                    console.log(JSON.stringify(getTsOp.body, null, 2));

                    const sets = objFromSets(getTsOp.body);
                    assert(!sets.examples, 'examples should no longer be in the disabled list');
                })
                .then(() => {
                    getTsOp.setUri('templatesets');
                    return worker.onGet(getTsOp);
                })
                .then(() => {
                    assert.equal(getTsOp.status, 200);
                    console.log(JSON.stringify(getTsOp.body, null, 2));

                    const sets = objFromSets(getTsOp.body);
                    assert.equal(sets.examples.enabled, true);
                })
                .then(() => worker.getConfig(0))
                .then((config) => {
                    console.log(JSON.stringify(config, null, 2));
                    assert.deepStrictEqual(config.deletedTemplateSets, []);
                });
        });
        it('delete_templateset', function () {
            const worker = createWorker();
            const templateSet = 'bigip-fast-templates';
            const op = new RestOp(`templatesets/${templateSet}`);

            return worker.templateProvider.hasSet(templateSet)
                .then(result => assert(result))
                .then(() => worker.onDelete(op))
                .then(() => assert.equal(op.status, 200))
                .then(() => worker.templateProvider.hasSet(templateSet))
                .then(result => assert(!result));
        });
        it('delete_templateset_bad', function () {
            const worker = createWorker();
            const op = new RestOp('templatesets/does_not_exist');

            return worker.onDelete(op)
                .then(() => {
                    assert.equal(op.status, 404);
                });
        });
        it('delete_templateset_inuse', function () {
            const worker = createWorker();
            const templateSet = 'examples';
            const op = new RestOp(`templatesets/${templateSet}`);
            resetScope(as3Scope)
                .get(as3ep)
                .query(true)
                .reply(200, Object.assign({}, as3stub, {
                    tenant: {
                        class: 'Tenant',
                        app: {
                            class: 'Application',
                            constants: {
                                [AS3DriverConstantsKey]: {
                                    template: 'examples/simple_udp_defaults'
                                }
                            }
                        },
                        app2: {
                            class: 'Application',
                            constants: {
                                [AS3DriverConstantsKey]: {
                                    template: 'foo/bar'
                                }
                            }
                        }
                    }
                }));
            return worker.onDelete(op)
                .then(() => {
                    assert.strictEqual(op.status, 400);
                    assert.match(op.body.message, /it is being used by:\n\["tenant\/app"\]/);
                });
        });
        it('delete_all_templatesets', function () {
            const worker = createWorker();
            const op = new RestOp('templatesets');

            return worker.onDelete(op)
                .then(() => assert.equal(op.status, 200))
                .then(() => worker.templateProvider.listSets())
                .then(setNames => assert.strictEqual(setNames.length, 0));
        });
    });

    describe('applications', function () {
        it('get_apps', function () {
            const worker = createWorker();
            const op = new RestOp('applications');
            return worker.onGet(op)
                .then(() => {
                    assert.notEqual(op.status, 404);
                    assert.deepEqual(op.body, [{
                        name: 'app',
                        tenant: 'tenant',
                        template: 'foo/bar'
                    }]);
                    expect(op.body).to.satisfySchemaInApiSpec('ApplicationList');
                });
        });
        it('get_apps_empty', function () {
            const worker = createWorker();
            const op = new RestOp('applications');
            as3Scope = resetScope(as3Scope)
                .get(as3ep)
                .query(true)
                .reply(204, '');
            return worker.onGet(op)
                .then(() => {
                    assert.notEqual(op.status, 404);
                    assert.deepEqual(op.body, []);
                });
        });
        it('get_apps_item_bad', function () {
            const worker = createWorker();
            const op = new RestOp('applications/foobar');
            return worker.onGet(op)
                .then(() => {
                    assert.equal(op.status, 404);
                });
        });
        it('get_apps_item', function () {
            const worker = createWorker();
            const op = new RestOp('applications/tenant/app');
            return worker.onGet(op)
                .then(() => {
                    assert.deepEqual(op.body, as3App);
                    expect(op.body).to.satisfySchemaInApiSpec('AS3App');
                });
        });
        it('post_apps_bad_tmplid', function () {
            const worker = createWorker();
            const op = new RestOp('applications');
            op.setBody({
                name: 'foobar/does_not_exist',
                parameters: {}
            });
            return worker.onPost(op)
                .then(() => {
                    assert.equal(op.status, 404);
                    assert.match(op.body.message, /Could not find template/);
                });
        });
        it('post_apps_bad_tmplid_leading_slash', function () {
            const worker = createWorker();
            const op = new RestOp('applications');
            op.setBody({
                name: '/examples/simple_udp_defaults',
                parameters: {}
            });
            return worker.onPost(op)
                .then(() => {
                    assert.equal(op.status, 400);
                    assert.match(op.body.message, /expected name to be of the form/);
                });
        });
        it('post_apps_bad_properties', function () {
            const worker = createWorker();
            const op = new RestOp('applications');
            op.setBody({
            });

            return worker.onPost(op)
                .then(() => {
                    console.log(JSON.stringify(op.body, null, 2));
                    assert.equal(op.status, 400);
                    assert.match(op.body.message, /name property is missing/);
                })
                .then(() => op.setBody({
                    name: 'examples/simple_udp_defaults'
                }))
                .then(() => worker.onPost(op))
                .then(() => {
                    console.log(JSON.stringify(op.body, null, 2));
                    assert.equal(op.status, 400);
                    assert.match(op.body.message, /parameters property is missing/);
                });
        });
        it('delete_app_bad', function () {
            const worker = createWorker();
            const op = new RestOp('applications/foobar');
            return worker.onDelete(op)
                .then(() => {
                    assert.equal(op.status, 404);
                });
        });
        it('delete_app', function () {
            const worker = createWorker();
            const op = new RestOp('applications/tenant/app');
            nock(host)
                .persist()
                .post(`${as3ep}/tenant?async=true`)
                .reply(202, {});
            return worker.onDelete(op)
                .then(() => {
                    assert.notEqual(op.status, 404);
                });
        });
        it('delete_all_apps', function () {
            const worker = createWorker();
            const op = new RestOp('applications');
            nock(host)
                .persist()
                .post(`${as3ep}/tenant?async=true`)
                .reply(202, {});
            return worker.onDelete(op)
                .then(() => {
                    assert.strictEqual(op.status, 202);
                });
        });
        it('patch_all_apps', function () {
            const worker = createWorker();
            const op = new RestOp('applications');
            return worker.onPatch(op)
                .then(() => {
                    assert.strictEqual(op.status, 400);
                });
        });
        it('record_user_agent', function () {
            const worker = createWorker();
            const op = new RestOp('applications?userAgent=test/v1.1');
            return worker.onGet(op)
                .then(() => {
                    assert.strictEqual(
                        worker.incomingUserAgent,
                        'test/v1.1'
                    );
                    assert.strictEqual(
                        worker.driver.userAgent,
                        `test/v1.1;${worker.baseUserAgent}`
                    );
                });
        });
        it('post_apps_bad_params', function () {
            const worker = createWorker();
            const op = new RestOp('applications');
            op.setBody({
                name: 'examples/simple_udp_defaults',
                parameters: {
                    virtual_port: 'foobar'
                }
            });
            return worker.onPost(op)
                .then(() => {
                    console.log(JSON.stringify(op.body, null, 2));
                    assert.equal(op.status, 400);
                    assert.match(op.body.message, /Parameters failed validation/);
                });
        });
        it('post_apps_no_overwrite', function () {
            const worker = createWorker();
            const op = new RestOp('applications');
            op.setBody({
                name: 'examples/simple_udp_defaults',
                parameters: {},
                allowOverwrite: false
            });

            resetScope(as3Scope)
                .get(as3ep)
                .query(true)
                .reply(200, Object.assign({}, as3stub, {
                    foo: {
                        class: 'Tenant',
                        bar: {
                            class: 'Application',
                            constants: {
                                [AS3DriverConstantsKey]: {}
                            }
                        }
                    }
                }));

            return worker.onPost(op)
                .then(() => {
                    console.log(JSON.stringify(op.body, null, 2));
                    assert.equal(op.status, 400);
                    assert.match(op.body.message, /application foo\/bar already exists/);
                });
        });
        it('post_apps_ipam', function () {
            const worker = createWorker();
            const ipamProvider = {
                name: 'testing',
                host: 'http://example.com',
                username: 'admin',
                password: 'password',
                retrieveUrl: '{{host}}/nextip',
                retrieveBody: '{ "num": 1}',
                retrievePathQuery: '$.addrs[0].ipv4',
                releaseUrl: '{{host}}/release/{{address}}',
                releaseBody: '{}'
            };
            worker.configStorage.data.config = {
                ipamProviders: [ipamProvider]
            };
            let retrievedAddr = '';
            let releasedAddr = '';
            const initialBody = {
                name: 'examples/simple_udp_ipam',
                parameters: {
                    use_ipam_addrs: true,
                    virtual_address_ipam: 'testing'
                }
            };
            nock('http://example.com')
                .post('/nextip', { num: 1 })
                .reply(200, { addrs: [{ ipv4: '192.0.0.0' }] })
                .post(/\/release\/.*/)
                .reply(200, (uri) => {
                    releasedAddr = uri.substr(uri.lastIndexOf('/') + 1);
                });
            nock(host)
                .persist()
                .get(as3ep)
                .query(true)
                .reply(200, as3stub);
            nock(host)
                .persist()
                .post(`${as3ep}/foo?async=true`, (body) => {
                    retrievedAddr = body.foo.bar.serviceMain.virtualAddresses[0];
                    return true;
                })
                .reply(202, {});
            // initial create
            const op = new RestOp('applications');
            op.setBody(initialBody);
            return worker.onPost(op)
                .then(() => {
                    console.log(JSON.stringify(op.body, null, 2));
                    assert.equal(op.status, 202);
                    assert.strictEqual(retrievedAddr, '192.0.0.0', 'should use address from IPAM');

                    // simulate update to a non-ipam to trigger release
                    initialBody.ipamAddrs = {
                        testing: [retrievedAddr]
                    };
                    op.setBody({
                        name: 'examples/simple_udp_ipam',
                        parameters: {
                            use_ipam_addrs: false,
                            virtual_address_ipam: undefined,
                            virtual_address: '10.10.1.2'
                        },
                        previousDef: initialBody
                    });
                    return worker.onPost(op);
                })
                .then(() => {
                    console.log(JSON.stringify(op.body, null, 2));
                    assert.strictEqual(releasedAddr, '192.0.0.0', 'should release previous IPAM address');
                    assert.strictEqual(retrievedAddr, '10.10.1.2', 'should update to non-IPAM address');
                });
        });
        it('post_apps', function () {
            const worker = createWorker();
            const op = new RestOp('applications');
            op.setBody({
                name: 'examples/simple_udp_defaults',
                parameters: {}
            });
            nock(host)
                .persist()
                .post(`${as3ep}/foo?async=true`)
                .reply(202, {});
            return worker.onPost(op)
                .then(() => {
                    console.log(JSON.stringify(op.body, null, 2));
                    assert.equal(op.status, 202);
                    expect(op.body).to.satisfySchemaInApiSpec('ApplicationResponse');
                });
        });
        it('patch_app', function () {
            const worker = createWorker();
            const op = new RestOp('applications/tenant/app');
            op.setBody({
                parameters: {
                    virtual_port: 5556
                }
            });
            resetScope(as3Scope)
                .get(as3ep)
                .query(true)
                .reply(200, Object.assign({}, as3stub, {
                    tenant: {
                        class: 'Tenant',
                        app: {
                            class: 'Application',
                            constants: {
                                [AS3DriverConstantsKey]: {
                                    template: 'examples/simple_udp_defaults',
                                    view: {
                                        tenant_name: 'tenant',
                                        application_name: 'app',
                                        virtual_address: '192.0.2.1',
                                        virtual_port: 5555,
                                        server_addresses: ['192.0.2.2'],
                                        service_port: 5555
                                    }
                                }
                            }
                        }
                    }
                }))
                .persist()
                .post(`${as3ep}/tenant?async=true`)
                .reply(202, {});

            return worker.onPatch(op)
                .then(() => {
                    console.log(JSON.stringify(op.body, null, 2));
                    assert.equal(op.status, 202);
                    expect(op.body).to.satisfySchemaInApiSpec('ApplicationResponse');
                });
        });
        it('convert_pool_members', function () {
            const worker = createWorker();
            as3Scope = resetScope(as3Scope)
                .get(as3ep)
                .query(true)
                .reply(200, Object.assign({}, as3stub, {
                    tenant: {
                        class: 'Tenant',
                        http: {
                            class: 'Application',
                            constants: {
                                [AS3DriverConstantsKey]: {
                                    template: 'bigip-fast-templates/http',
                                    view: {
                                        tenant_name: 'tenant',
                                        app_name: 'http',
                                        enable_pool: true,
                                        make_pool: true,
                                        pool_port: 80,
                                        pool_members: [
                                            '10.0.0.1'
                                        ]
                                    }
                                }
                            }
                        },
                        tcp: {
                            class: 'Application',
                            constants: {
                                [AS3DriverConstantsKey]: {
                                    template: 'bigip-fast-templates/tcp',
                                    view: {
                                        tenant_name: 'tenant',
                                        app_name: 'tcp',
                                        enable_pool: true,
                                        make_pool: true,
                                        pool_members: [
                                            '10.0.0.2'
                                        ]
                                    }
                                }
                            }
                        },
                        tcpNew: {
                            class: 'Application',
                            constants: {
                                [AS3DriverConstantsKey]: {
                                    template: 'bigip-fast-templates/tcp',
                                    view: {
                                        enable_pool: true,
                                        make_pool: true,
                                        pool_members: [
                                            {
                                                serverAddresses: [
                                                    '10.0.0.1'
                                                ],
                                                servicePort: 389,
                                                connectionLimit: 0,
                                                priorityGroup: 0,
                                                shareNodes: true
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    }
                }))
                .persist()
                .post(`${as3ep}/tenant?async=true`)
                .reply(202, {
                    code: 202,
                    message: [
                        { id: '0' }
                    ]
                });

            nock(host)
                .persist()
                .get(/mgmt\/tm\/.*\?\$select=fullPath/)
                .reply(200, {
                    items: [
                        { fullPath: '/Common/httpcompression' },
                        { fullPath: '/Common/wan-optimized-compression' }
                    ]
                });
            const op = new RestOp('applications');
            return worker.onGet(op)
                .then(() => {
                    console.log(op.body);
                    assert(as3Scope.isDone());
                });
        });
    });

    describe('bad endpoints', function () {
        it('get_bad_end_point', function () {
            const worker = createWorker();
            const op = new RestOp('bad');
            return worker.onGet(op)
                .then(() => {
                    assert.equal(op.status, 404);
                });
        });
        it('post_bad_end_point', function () {
            const worker = createWorker();
            const op = new RestOp('bad');
            return worker.onPost(op)
                .then(() => {
                    assert.equal(op.status, 404);
                });
        });
        it('delete_bad_end_point', function () {
            const worker = createWorker();
            const op = new RestOp('bad');
            return worker.onDelete(op)
                .then(() => {
                    assert.equal(op.status, 404);
                });
        });
        it('patch_bad_end_point', function () {
            const worker = createWorker();
            const op = new RestOp('bad');
            return worker.onPatch(op)
                .then(() => {
                    assert.equal(op.status, 404);
                });
        });
    });
});
