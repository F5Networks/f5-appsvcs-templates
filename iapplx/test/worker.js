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
}

const patchWorker = (worker) => {
    worker.prototype.logger = {
        severe: console.error,
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

describe('template worker tests', function () {
    const host = 'http://localhost:8105';
    const as3ep = '/shared/appsvcs/declare';
    const as3TaskEp = '/shared/appsvcs/task';
    const as3stub = {
        class: 'ADC',
        schemaVersion: '3.0.0'
    };

    patchWorker(TemplateWorker);

    afterEach(function () {
        nock.cleanAll();
    });

    it('info', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('info');
        nock('http://localhost:8100')
            .get('/mgmt/shared/appsvcs/info')
            .reply(200, {});

        return worker.onGet(op)
            .then(() => {
                assert.strictEqual(op.status, 200);
            });
    });
    it('info_without_as3', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('info');
        nock('http://localhost:8100')
            .get('/mgmt/shared/appsvcs/info')
            .reply(404);

        return worker.onGet(op)
            .then(() => {
                assert.strictEqual(op.status, 200);
            });
    });
    it('get_bad_end_point', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('bad');
        return worker.onGet(op)
            .then(() => {
                assert.equal(op.status, 404);
            });
    });
    it('get_templates', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('templates');
        return worker.onGet(op)
            .then(() => {
                const templates = op.body;
                assert.notEqual(op.status, 404);
                assert.notEqual(templates.length, 0);
            });
    });
    it('get_template_bad', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('templates/foobar');
        return worker.onGet(op)
            .then(() => {
                assert.equal(op.status, 404);
            });
    });
    it('get_template_item', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('templates/f5-simple/simple_udp');
        return worker.onGet(op)
            .then(() => {
                const tmpl = op.body;
                assert.notEqual(op.status, 404);
                assert.notEqual(tmpl, {});
            });
    });
    it('get_template_item_with_schema', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('templates/f5-debug/http-basic');
        return worker.onGet(op)
            .then(() => {
                const tmpl = op.body;
                assert.notEqual(op.status, 404);
                assert.notEqual(tmpl, {});
                assert.notEqual(tmpl.getViewSchema(), {});
            });
    });
    it('get_apps', function () {
        const worker = new TemplateWorker();
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
        const worker = new TemplateWorker();
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
        const worker = new TemplateWorker();
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
        const worker = new TemplateWorker();
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
        const worker = new TemplateWorker();
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
        const worker = new TemplateWorker();
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
        const worker = new TemplateWorker();
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
        const worker = new TemplateWorker();
        const op = new RestOp('templatesets');
        return worker.onGet(op)
            .then(() => {
                assert.notEqual(op.status, 404);
                assert.notEqual(op.status, 500);
                assert.deepEqual(op.body, ['f5-debug', 'f5-simple']);
            });
    });
    it('get_templatesets_item', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('templatesets/f5-debug');
        return worker.onGet(op)
            .then(() => {
                assert.notEqual(op.status, 404);
                assert.notEqual(op.status, 500);
                assert.notDeepEqual(op.body, {});
            });
    });
    it('get_templatesets_bad', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('templatesets/foo1');
        return worker.onGet(op)
            .then(() => {
                assert.strictEqual(op.status, 404);
            });
    });
    it('post_bad_end_point', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('bad');
        return worker.onPost(op)
            .then(() => {
                assert.equal(op.status, 404);
            });
    });
    it('post_apps_bad_tmplid', function () {
        const worker = new TemplateWorker();
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
        const worker = new TemplateWorker();
        const op = new RestOp('applications');
        op.setBody({
            name: 'f5-debug/simple_udp_defaults',
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
        const worker = new TemplateWorker();
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
        const worker = new TemplateWorker();
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
        const worker = new TemplateWorker();
        const op = new RestOp('applications');
        return worker.onDelete(op)
            .then(() => {
                assert.strictEqual(op.status, 405);
            });
    });
    it('delete_bad_end_point', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('bad');
        return worker.onDelete(op)
            .then(() => {
                assert.equal(op.status, 404);
            });
    });
    it('post_templateset_missing', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('templatesets');
        op.setBody({
            name: 'badname'
        });
        mockfs({
        });

        return worker.onPost(op)
            .then(() => assert.equal(op.status, 404))
            .finally(() => mockfs.restore());
    });
    it('post_templateset', function () {
        const worker = new TemplateWorker();
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
                assert(fs.existsSync(tsPath));
                assert.equal(op.status, 200);
                assert(fs.existsSync(path.join(tsPath, 'testset')));
            })
            .finally(() => mockfs.restore());
    });
    it('delete_templateset', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('templatesets/f5-debug');
        const tsPath = path.join(process.cwd(), '..', 'templates', 'f5-debug');

        mockfs({
            [tsPath]: {}
        });

        return worker.onDelete(op)
            .then(() => {
                assert.equal(op.status, 200);
                assert(!fs.existsSync(tsPath));
            })
            .finally(() => mockfs.restore());
    });
    it('delete_templateset_bad', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('templatesets/does_not_exist');

        return worker.onDelete(op)
            .then(() => {
                assert.equal(op.status, 404);
            });
    });
});
