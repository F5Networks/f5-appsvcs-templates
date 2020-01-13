/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

process.AFL_TW_ROOT = '../';

const assert = require('assert').strict;

const TemplateWorker = require('../nodejs/templateWorker.js');

class RestOp {
    constructor(uri) {
        this.uri = uri;
        this.body = '';
    }

    setHeaders() {}

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
};

describe('template worker tests', function () {
    patchWorker(TemplateWorker);
    it('info', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('info');
        return worker.onGet(op)
            .then(() => {
                assert.equal(op.body.code, 200);
            });
    });
    it('get_bad_end_point', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('bad');
        return worker.onGet(op)
            .then(() => {
                assert.equal(op.body.code, 404);
            });
    });
    it('get_templates', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('templates');
        return worker.onGet(op)
            .then(() => {
                const templates = op.body;
                assert.notEqual(op.body.code, 404);
                assert.notEqual(templates.length, 0);
            });
    });
    it('get_template_bad', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('templates/foobar');
        return worker.onGet(op)
            .then(() => {
                assert.equal(op.body.code, 404);
            });
    });
    it('get_template_item', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('templates/simple_https');
        return worker.onGet(op)
            .then(() => {
                const tmpl = op.body;
                assert.notEqual(op.body.code, 404);
                assert.notEqual(tmpl, {});
            });
    });
    it('get_template_item_with_schema', function () {
        const worker = new TemplateWorker();
        const op = new RestOp('templates/f5_https');
        return worker.onGet(op)
            .then(() => {
                const tmpl = op.body;
                assert.notEqual(op.body.code, 404);
                assert.notEqual(tmpl, {});
                assert.notEqual(tmpl.getViewSchema(), {});
            });
    });
});
