/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

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
        return assert.isRejected(provider.fetch('does_not_exist'));
    });
    it('load_list', function () {
        const provider = new FsSchemaProvider(schemasPath);
        return provider.list()
            .then((templates) => {
                assert.ok(templates);
                assert.notStrictEqual(templates.length, 0);
            });
    });
    it('bad_schema_path', function () {
        const provider = new FsSchemaProvider('bad/path');
        return Promise.all([
            assert.isRejected(provider.list()),
            assert.isRejected(provider.fetch('f5'))
        ]);
    });
});
