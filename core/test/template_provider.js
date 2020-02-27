/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const { FsTemplateProvider, DataStoreTemplateProvider } = require('../lib/template_provider');
const StorageMemory = require('../dataStores').StorageMemory;

const templatesPath = './test/templatesets';

function runSharedTests(createProvider) {
    it('construct', function () {
        const provider = createProvider();
        assert.ok(provider);
    });
    it('load_list', function () {
        const provider = createProvider();
        return provider.list()
            .then((tmplList) => {
                assert.deepStrictEqual(tmplList.sort(), [
                    'test/complex',
                    'test/simple',
                    'test/simple_udp'
                ]);
            });
    });
    it('load_list_filter', function () {
        const provider = createProvider(['foo']);
        return provider.list()
            .then((templates) => {
                assert.ok(templates);
                assert.strictEqual(templates.length, 0);
            });
    });
    it('list_sets', function () {
        const provider = createProvider();
        return assert.becomes(provider.listSets(), ['test']);
    });
    it('load_single_complex', function () {
        const provider = createProvider();
        return provider.fetch('test/complex')
            .then((tmpl) => {
                assert.ok(tmpl);
                console.log(JSON.stringify(tmpl, null, 2));
                assert.strictEqual(tmpl.title, 'chat window');
                assert.strictEqual(tmpl.description, '');
                assert.strictEqual(tmpl.target, 'as3');
                assert.ok(tmpl.definitions.chatlog);
            });
    });
    it('load_single_with_schema', function () {
        const provider = createProvider();
        return provider.fetch('test/simple')
            .then((tmpl) => {
                assert.ok(tmpl);
                console.log(JSON.stringify(tmpl, null, 3));
                assert.strictEqual(tmpl.title, 'Simple YAML file');
                assert.strictEqual(tmpl.target, 'as3');
            });
    });
    it('load_single_bad', function () {
        const provider = createProvider();
        return assert.isRejected(provider.fetch('does_not_exist'));
    });
    it('load_multiple', function () {
        const provider = createProvider();
        return assert.isFulfilled(provider.fetch('test/simple'))
            .then(() => assert.isFulfilled(provider.fetch('test/complex')))
            .then(() => assert.isFulfilled(provider.fetch('test/simple')));
    });
}

describe('template provider tests', function () {
    describe('FsTemplateProvider', function () {
        runSharedTests(
            filtered => new FsTemplateProvider(templatesPath, filtered)
        );
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
        it('bad_tmpl_path', function () {
            const provider = new FsTemplateProvider('bad/path');
            return Promise.all([
                assert.isRejected(provider.list()),
                assert.isRejected(provider.fetch('simple_udp'))
            ]);
        });
        it('remove_tmpl_set', function () {
            const provider = new FsTemplateProvider(templatesPath);
            return assert.isRejected(provider.removeSet('example'), /not implemented/);
        });
    });
    describe('DataStoreTemplateProvider', function () {
        const testStorage = new StorageMemory();
        before(function () {
            return DataStoreTemplateProvider.fromFs(testStorage, templatesPath);
        });
        const createProvider = filtered => new DataStoreTemplateProvider(testStorage, filtered);

        runSharedTests(createProvider);

        it('load_single_bad_tmpl_path', function () {
            const provider = createProvider();
            return assert.isRejected(provider.fetch('test/badpath'));
        });
        it('remove_tmpl_set', function () {
            const provider = createProvider();
            return assert.isFulfilled(provider.removeSet('test'))
                .then(() => assert.becomes(provider.listSets(), []));
        });
        it('remove_tmpl_set_missing', function () {
            const provider = createProvider();
            return assert.isRejected(provider.removeSet('does_not_exist'), /failed to find template set/);
        });
    });
});
