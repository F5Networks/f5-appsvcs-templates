/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const { FsTemplateProvider } = require('../lib/template_provider');

const templatesPath = './test/templatesets';

describe('template provider tests', function () {
    it('construct', function () {
        const provider = new FsTemplateProvider(templatesPath);
        assert.ok(provider);
    });
    it('load_single_mst', function () {
        const provider = new FsTemplateProvider(templatesPath);
        return provider.fetch('test/simple_udp')
            .then((tmpl) => {
                assert.ok(tmpl);
            });
    });
    it('load_single_yml', function () {
        const provider = new FsTemplateProvider(templatesPath);
        return provider.fetch('test/complex')
            .then((tmpl) => {
                assert.ok(tmpl);
            });
    });
    it('load_single_with_schema', function () {
        const provider = new FsTemplateProvider(templatesPath);
        return provider.fetch('test/simple')
            .then((tmpl) => {
                assert.ok(tmpl);
            });
    });
    it('load_single_bad', function () {
        const provider = new FsTemplateProvider(templatesPath);
        return assert.isRejected(provider.fetch('does_not_exist'));
    });
    it('load_list', function () {
        const provider = new FsTemplateProvider(templatesPath);
        return provider.list()
            .then((templates) => {
                assert.ok(templates);
                assert.notStrictEqual(templates.length, 0);
            });
    });
    it('load_list_filter', function () {
        const provider = new FsTemplateProvider(templatesPath, ['foo']);
        return provider.list()
            .then((templates) => {
                assert.ok(templates);
                assert.strictEqual(templates.length, 0);
            });
    });
    it('bad_tmpl_path', function () {
        const provider = new FsTemplateProvider('bad/path');
        return Promise.all([
            assert.isRejected(provider.list()),
            assert.isRejected(provider.fetch('simple_udp'))
        ]);
    });
    it('load_multiple', function () {
        const provider = new FsTemplateProvider(templatesPath);
        return assert.isFulfilled(provider.fetch('test/simple'))
            .then(() => assert.isFulfilled(provider.fetch('test/complex')))
            .then(() => assert.isFulfilled(provider.fetch('test/simple')));
    });
});
