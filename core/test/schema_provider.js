/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const StorageMemory = require('atg-storage').StorageMemory;
const { FsSchemaProvider, DataStoreSchemaProvider } = require('../lib/schema_provider');

const schemasPath = './test/templatesets/test/';

function runSharedTests(createProvider) {
    it('construct', function () {
        const provider = createProvider();
        assert.ok(provider);
    });
    it('load_single', function () {
        const provider = createProvider();
        return provider.fetch('types')
            .then(schema => JSON.parse(schema))
            .then((schema) => {
                assert.ok(schema);
                console.log(JSON.stringify(schema, null, 2));
                assert.ok(schema.definitions.port);
            });
    });
    it('load_single_bad', function () {
        const provider = createProvider();
        return assert.isRejected(provider.fetch('does_not_exist'));
    });
    it('load_list', function () {
        const provider = createProvider();
        return assert.becomes(provider.list(), [
            'types'
        ]);
    });
}

describe('schema provider tests', function () {
    describe('FsSchemaProvider', function () {
        runSharedTests(() => new FsSchemaProvider(schemasPath));
        it('bad_schema_path', function () {
            const provider = new FsSchemaProvider('bad/path');
            return Promise.all([
                assert.isRejected(provider.list()),
                assert.isRejected(provider.fetch('f5'))
            ]);
        });
    });

    describe('DataStoreSchemaProvider', function () {
        runSharedTests(() => {
            const datastore = new StorageMemory({
                test: {
                    templates: {},
                    schemas: fs.readdirSync(`${schemasPath}`).filter(x => x.endsWith('.json')).reduce(
                        (acc, fname) => {
                            acc[fname.slice(0, -5)] = fs.readFileSync(`${schemasPath}/${fname}`, { encoding: 'utf8' });
                            return acc;
                        }, {}
                    )
                }
            });
            return new DataStoreSchemaProvider(datastore, 'test');
        });
    });
});
