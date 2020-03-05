/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const mockfs = require('mock-fs');
const path = require('path');

process.AFL_TW_ROOT = path.join(process.cwd(), '../templates');
process.AFL_TW_TS = path.join(process.cwd(), '../templates');

const fs = require('fs');
const assert = require('assert').strict;
const nock = require('nock');

const fast = require('@f5devcentral/fast');

const AS3DriverConstantsKey = fast.AS3DriverConstantsKey;

const TemplateWorker = require('../nodejs/templateWorker.js');

class RestOp {
    constructor(uri) {
        this.uri = uri;
        this.body = '';
        this.status = 200;
    }

    setHeaders() {}

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

    getUri() {
        return {
            path: `/a/b/${this.uri}`
        };
    }

    getMethod() {
        return '';
    }
}

const patchWorker = (worker) => {
    worker.prototype.logger = {
        severe: console.error,
        error: console.error,
        info: console.log,
        fine: console.log,
        log: console.log
    };
    worker.prototype.completedRestOp = false;
    worker.prototype.completeRestOperation = function (op) {
        console.log('Completed REST Operation:');
        console.log(JSON.stringify(op, null, 2));
        this.completedRestOp = true;
    };
    const ensureCompletedOp = (fn) => {
        worker.prototype[`_${fn}`] = worker.prototype[fn];
        worker.prototype[fn] = function (op) {
            this.completedRestOp = false;
            return this[`_${fn}`](op)
                .then(() => {
                    if (!this.completedRestOp) {
                        throw Error(`failed to call completeRestOperation() in ${fn}()`);
                    }
                });
        };
    };
    ensureCompletedOp('onGet');
    ensureCompletedOp('onPost');
    ensureCompletedOp('onDelete');
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

function createTemplateWorker() {
    const tw = new TemplateWorker();
    tw.storage = testStorage;
    tw.templateProvider.storage = testStorage;
    tw.teemDevice = new TeemDeviceMock();
    return tw;
}

describe('template worker tests', function () {
    const host = 'http://localhost:8105';
    const as3ep = '/shared/appsvcs/declare';
    const as3TaskEp = '/shared/appsvcs/task';
    const as3stub = {
        class: 'ADC',
        schemaVersion: '3.0.0'
    };

    patchWorker(TemplateWorker);

    beforeEach(function () {
        testStorage = new fast.dataStores.StorageMemory();
        return fast.DataStoreTemplateProvider.fromFs(testStorage, process.AFL_TW_TS);
    });

    afterEach(function () {
        nock.cleanAll();
    });

    it('info', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('info');
        nock('http://localhost:8100')
            .get('/mgmt/shared/appsvcs/info')
            .reply(200, {});

        return worker.onGet(op)
            .then(() => {
                const info = op.body;
                assert.strictEqual(op.status, 200);
                console.log(JSON.stringify(info, null, 2));
                assert.notEqual(info.installedTemplates, []);
                assert(Object.keys(info.installedTemplates).includes('bigip-fast-templates/http'));
                assert(Object.keys(info.installedTemplates).includes('examples/simple_udp'));
                assert.strictEqual(
                    info.installedTemplates['examples/simple_udp'],
                    'aa0e1ca8a7ea913c47c414f4a9f2c01e40302fff5dc13c157d088c4f5d9b7989'
                );
            });
    });
    it('info_without_as3', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('info');
        nock('http://localhost:8100')
            .get('/mgmt/shared/appsvcs/info')
            .reply(404);

        return worker.onGet(op)
            .then(() => {
                const info = op.body;
                assert.strictEqual(op.status, 200);
                console.log(JSON.stringify(info, null, 2));
                assert.notEqual(info.installedTemplates, []);
                assert(Object.keys(info.installedTemplates).includes('bigip-fast-templates/http'));
                assert(Object.keys(info.installedTemplates).includes('examples/simple_udp'));
                assert.strictEqual(
                    info.installedTemplates['examples/simple_udp'],
                    'aa0e1ca8a7ea913c47c414f4a9f2c01e40302fff5dc13c157d088c4f5d9b7989'
                );
            });
    });
    it('get_bad_end_point', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('bad');
        return worker.onGet(op)
            .then(() => {
                assert.equal(op.status, 404);
            });
    });
    it('get_templates', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('templates');
        return worker.onGet(op)
            .then(() => {
                const templates = op.body;
                assert.notEqual(op.status, 404);
                assert.notEqual(templates.length, 0);
            });
    });
    it('get_template_bad', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('templates/foobar');
        return worker.onGet(op)
            .then(() => {
                assert.equal(op.status, 404);
            });
    });
    it('get_template_item', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('templates/examples/simple_udp');
        return worker.onGet(op)
            .then(() => {
                const tmpl = op.body;
                console.log(op.body.message);
                assert.strictEqual(op.status, 200);
                assert.notEqual(tmpl, {});
            });
    });
    it('get_template_item_with_schema', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('templates/bigip-fast-templates/http');
        return worker.onGet(op)
            .then(() => {
                const tmpl = op.body;
                assert.equal(op.status, 200);
                assert.notEqual(tmpl, {});
                assert.notEqual(tmpl.getViewSchema(), {});
            });
    });
    it('get_apps', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('applications');
        nock(host)
            .get(as3ep)
            .reply(200, Object.assign({}, as3stub, {
                tenant: {
                    class: 'Tenant',
                    app: {
                        class: 'Application',
                        constants: {
                            [AS3DriverConstantsKey]: {}
                        }
                    }
                }
            }));
        return worker.onGet(op)
            .then(() => {
                assert.notEqual(op.status, 404);
                assert.deepEqual(op.body, [{
                    name: 'app',
                    tenant: 'tenant'
                }]);
            });
    });
    it('get_apps_empty', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('applications');
        nock(host)
            .get(as3ep)
            .reply(204, '');
        return worker.onGet(op)
            .then(() => {
                assert.notEqual(op.status, 404);
                assert.deepEqual(op.body, []);
            });
    });
    it('get_apps_item_bad', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('applications/foobar');
        nock(host)
            .get(as3ep)
            .reply(200, Object.assign({}, as3stub, {
                tenant: {
                    class: 'Tenant',
                    app: {
                        class: 'Application'
                    }
                }
            }));
        return worker.onGet(op)
            .then(() => {
                assert.equal(op.status, 404);
            });
    });
    it('get_apps_item', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('applications/tenant/app');
        const appData = {
            foo: 'bar'
        };
        const as3App = {
            class: 'Application',
            constants: {
                [AS3DriverConstantsKey]: appData
            }
        };
        nock('http://localhost:8100')
            .get('/mgmt/shared/appsvcs/declare')
            .reply(200, Object.assign({}, as3stub, {
                tenant: {
                    class: 'Tenant',
                    app: as3App
                }
            }));
        return worker.onGet(op)
            .then(() => {
                assert.deepEqual(op.body, as3App);
            });
    });
    it('get_tasks', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('tasks');
        worker.driver._task_ids.unshift('foo1');
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
                    id: 'foo1',
                    code: 200,
                    message: 'in progress',
                    name: '',
                    parameters: {}
                }]);
            });
    });
    it('get_tasks_item', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('tasks/foo1');
        worker.driver._task_ids.unshift('foo1');
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
                    id: 'foo1',
                    code: 200,
                    message: 'in progress',
                    name: '',
                    parameters: {}
                });
            });
    });
    it('get_tasks_bad', function () {
        const worker = createTemplateWorker();
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
    it('get_templatesets', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('templatesets');
        return worker.onGet(op)
            .then(() => {
                assert.notEqual(op.status, 404);
                assert.notEqual(op.status, 500);
                assert(op.body.includes('bigip-fast-templates'));
                assert(op.body.includes('examples'));
            });
    });
    it('get_templatesets_item', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('templatesets/bigip-fast-templates');
        return worker.onGet(op)
            .then(() => {
                assert.notEqual(op.status, 404);
                assert.notEqual(op.status, 500);
                assert.notDeepEqual(op.body, {});
            });
    });
    it('get_templatesets_bad', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('templatesets/foo1');
        return worker.onGet(op)
            .then(() => {
                assert.strictEqual(op.status, 404);
            });
    });
    it('post_bad_end_point', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('bad');
        return worker.onPost(op)
            .then(() => {
                assert.equal(op.status, 404);
            });
    });
    it('post_apps_bad_tmplid', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('applications');
        op.setBody({
            name: 'foobar'
        });
        return worker.onPost(op)
            .then(() => {
                assert.equal(op.status, 400);
            });
    });
    it('post_apps', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('applications');
        op.setBody({
            name: 'examples/simple_udp_defaults',
            parameters: {}
        });
        nock(host)
            .persist()
            .get(as3ep)
            .reply(200, as3stub);
        nock(host)
            .persist()
            .post(`${as3ep}?async=true`)
            .reply(202, {});
        return worker.onPost(op)
            .then(() => {
                console.log(JSON.stringify(op.body, null, 2));
                assert.equal(op.status, 202);
            });
    });
    it('delete_app_bad', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('applications/foobar');
        nock(host)
            .get(as3ep)
            .reply(200, Object.assign({}, as3stub, {
                tenant: {
                    class: 'Tenant',
                    app: {
                        class: 'Application'
                    }
                }
            }));
        return worker.onDelete(op)
            .then(() => {
                assert.equal(op.status, 404);
            });
    });
    it('delete_app', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('applications/tenant/app');
        nock(host)
            .get(as3ep)
            .reply(200, Object.assign({}, as3stub, {
                tenant: {
                    class: 'Tenant',
                    app: {
                        class: 'Application',
                        constants: {
                            [AS3DriverConstantsKey]: {}
                        }
                    }
                }
            }));
        nock(host)
            .persist()
            .post(`${as3ep}?async=true`)
            .reply(202, {});
        return worker.onDelete(op)
            .then(() => {
                assert.notEqual(op.status, 404);
            });
    });
    it('delete_all_apps', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('applications');
        return worker.onDelete(op)
            .then(() => {
                assert.strictEqual(op.status, 405);
            });
    });
    it('delete_bad_end_point', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('bad');
        return worker.onDelete(op)
            .then(() => {
                assert.equal(op.status, 404);
            });
    });
    it('post_templateset_missing', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('templatesets');
        op.setBody({
            name: 'badname'
        });
        mockfs({
        });

        return worker.onPost(op)
            .then(() => assert.equal(op.status, 404))
            .then(() => {
                op.setBody({});
                return worker.onPost(op);
            })
            .then(() => assert.equal(op.status, 400))
            .finally(() => mockfs.restore());
    });
    it('post_templateset', function () {
        const worker = createTemplateWorker();
        const op = new RestOp('templatesets');
        const tsPath = path.join(process.cwd(), '..', 'templates');

        op.setBody({
            name: 'testset'
        });
        mockfs({
            '/var/config/rest/downloads': {
                'testset.zip': fs.readFileSync('./test/testset.zip')
            },
            [tsPath]: {}
        });

        return worker.onPost(op)
            .then(() => {
                assert.equal(op.status, 200);
            })
            .then(() => worker.templateProvider.listSets())
            .then((tmplSets) => {
                assert(fs.existsSync(`${tsPath}/scratch`));
                assert(tmplSets.includes('testset'));
            })
            .finally(() => mockfs.restore());
    });
    it('delete_templateset', function () {
        const worker = createTemplateWorker();
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
        const worker = createTemplateWorker();
        const op = new RestOp('templatesets/does_not_exist');

        return worker.onDelete(op)
            .then(() => {
                assert.equal(op.status, 404);
            });
    });
    it('on_start', function () {
        const worker = createTemplateWorker();

        // Clear the data store
        worker.storage.data = {};

        // "Install" a template set to make sure it is not overridden
        worker.storage.data['bigip-fast-templates'] = {
            name: 'bigip-fast-templatesets',
            schema: {},
            templates: {}
        };

        nock('http://localhost:8100')
            .get('/shared/iapp/blocks')
            .reply(200, { items: [] })
            .post('/shared/iapp/blocks')
            .reply(200, {});

        return worker.onStart(
            () => {}, // success callback
            () => assert(false) // error callback
        )
            .then(() => worker.templateProvider.list())
            .then((tmplList) => {
                assert(tmplList.includes('examples/simple_http'));
                assert(!tmplList.includes('bigip-fast-templates/http'));
            });
    });
    it('onStartCompleted', function () {
        const worker = createTemplateWorker();
        nock('http://localhost:8100')
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
});
