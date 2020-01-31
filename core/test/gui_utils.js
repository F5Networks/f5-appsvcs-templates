/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const assert = require('assert');

const guiUtils = require('../lib/gui_utils');

describe('GUI utils test', function () {
    it('add_title', function () {
        const schema = {};
        guiUtils.modSchemaForJSONEditor(schema);
        assert.strictEqual(schema.title, 'Template');
    });
    it('inject_formats', function () {
        const schema = {
            properties: {
                bool: { type: 'boolean' },
                table: { type: 'array' },
                str: { type: 'string' }
            }
        };
        guiUtils.modSchemaForJSONEditor(schema);
        assert.strictEqual(schema.properties.bool.format, 'checkbox');
        assert.strictEqual(schema.properties.table.format, 'table');
        assert.strictEqual(schema.properties.str.format, undefined);
    });
    it('add_deps', function () {
        const schema = {
            properties: {
                useFoo: { type: 'boolean' },
                foo: { type: 'string' }
            },
            dependencies: {
                foo: ['useFoo']
            }
        };
        guiUtils.modSchemaForJSONEditor(schema);
        console.log(JSON.stringify(schema, null, 2));
        assert.deepStrictEqual(schema.properties.foo.options.dependencies, { useFoo: true });
    });
    it('filter_extra_props', function () {
        const schema = {
            properties: {
                foo: { type: 'string' }
            }
        };
        const view = {
            foo: 'bar',
            baz: 0
        };
        const filteredView = guiUtils.filterExtraProperties(view, schema);
        assert.deepStrictEqual(filteredView, { foo: 'bar' });

        assert.deepStrictEqual(guiUtils.filterExtraProperties(view, {}), {});
    });
});
