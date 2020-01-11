/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const assert = require('assert').strict;

const { FsSchemaProvider } = require('../lib/schema_provider');

const schemasPath = './../schemas';

describe('template provider tests', function () {
    it('construct', function () {
        const provider = new FsSchemaProvider(schemasPath);
        assert.ok(provider);
    });
    it('load_single', function () {
        const provider = new FsSchemaProvider(schemasPath);
        return provider.fetch('f5')
            .then((tmpl) => {
                assert.ok(tmpl);
            });
    });
    it('load_single_bad', function () {
        const provider = new FsSchemaProvider(schemasPath);
        return provider.fetch('does_not_exist')
            .then(() => {
                assert(false);
            })
            .catch(() => {});
    });
    it('load_list', function () {
        const provider = new FsSchemaProvider(schemasPath);
        return provider.list()
            .then((templates) => {
                assert.ok(templates);
                assert.notEqual(templates.length, 0);
            });
    });
});
