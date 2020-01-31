/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const assert = require('assert').strict;

const FsSchemaProvider = require('../lib/schema_provider').FsSchemaProvider;
const Template = require('../lib/template').Template;

const mstWithTypes = `{
    "name" : "test template",
    "default" : "{{variable1}}",
    "string_type" : {{string_variable::string}},
    "array_type" : [
      {{#array_variable}}
        "{{.}}",
      {{/array_variable}}
    ],
    "boolean_type" : {{boolean_variable::boolean}},
    "number_type" : {{number_variable::number}},
    "duplicate_key": "{{variable1}}"
`;

describe('Template class tests', function () {
    const schemaProvider = new FsSchemaProvider('./../schemas');

    it('construct', function () {
        const tmpl = new Template();
        assert.ok(tmpl);
    });
    it('load_mustache', function () {
        const mstdata = `
            {{!
                Just a basic template
            }}
            {
                {{foo}}
            }
        `;

        const reference = new Template();
        reference.description = 'Just a basic template';
        reference.templateText = mstdata;

        return Template.loadMst(schemaProvider, mstdata)
            .then((tmpl) => {
                reference._viewSchema = tmpl._viewSchema;
                assert.ok(tmpl);
                assert.deepStrictEqual(tmpl, reference);
            });
    });
    it('load_yaml', function () {
        const ymldata = `
            view:
              message: Hello!
            definitions:
              body:
                template:
                  <body>
                    <h1>{{message}}</h1>
                  </body>
            template: |
              <html>
                {{> body}}
              </html>
        `;

        return Template.loadYaml(schemaProvider, ymldata)
            .then((tmpl) => {
                assert.ok(tmpl);
            });
    });
    it('from_json', function () {
        return Template.loadMst(null, mstWithTypes)
            .then((tmpl) => {
                const jsondata = JSON.stringify(tmpl);
                let jsontmpl = Template.fromJson(jsondata);
                console.log(jsondata);
                console.log(jsontmpl);
                assert.deepEqual(jsontmpl, tmpl);

                jsontmpl = Template.fromJson(JSON.parse(jsondata));
                assert.deepEqual(jsontmpl, tmpl);
            });
    });
    it('missing_dscription', function () {
        const mstdata = '{{{foo}}: {{bar}}}';
        return Template.loadMst(schemaProvider, mstdata)
            .then((tmpl) => {
                assert.ok(tmpl);
                assert.strictEqual(tmpl.description, '');
            });
    });
    it('get_schema', function () {
        const reference = {
            type: 'object',
            properties: {
                variable1: { type: 'string' },
                string_variable: { type: 'string' },
                array_variable: {
                    type: 'array',
                    items: {
                        type: 'string'
                    }
                },
                boolean_variable: { type: 'boolean' },
                number_variable: { type: 'number' }
            },
            required: [
                'variable1',
                'string_variable',
                'array_variable',
                'boolean_variable',
                'number_variable'
            ],
            title: '',
            description: ''
        };
        return Template.loadMst(schemaProvider, mstWithTypes)
            .then((tmpl) => {
                assert.deepStrictEqual(tmpl.getViewSchema(), reference);
            });
    });
    it('load_complex_mustache', function () {
        const mstdata = fs.readFileSync('./../templates/f5_https.mst', 'utf8');
        return Template.loadMst(schemaProvider, mstdata)
            .then((tmpl) => {
                assert.ok(tmpl);
            });
    });
    it('load_complex_yaml', function () {
        const ymldata = fs.readFileSync('./test/complex.yml', 'utf8');
        return Template.loadYaml(schemaProvider, ymldata)
            .then((tmpl) => {
                assert.ok(tmpl);
            });
    });
    it('fail_validation', function () {
        const mstdata = `
            {{foo}
        `;
        assert.throws(() => Template.validate(mstdata));

        // should fail for missing template, but still passes as valid mustache
        // const ymldata = 'title: foo';
        // assert.throws(() => Template.validate(ymldata));
    });
    it('render', function () {
        const mstdata = `
            {{foo::string}}
        `;
        const view = {
            foo: 'bar'
        };
        const reference = `
            bar
        `;
        return Template.loadMst(schemaProvider, mstdata)
            .then((tmpl) => {
                assert.strictEqual(tmpl.render(view), reference);
            });
    });
    it('load_partials', function () {
        const ymldata = fs.readFileSync('./test/complex.yml', 'utf8');
        return Template.loadYaml(null, ymldata)
            .then((tmpl) => {
                assert.notStrictEqual(tmpl._getPartials(), {});
            });
    });
    it('render_partial_with_type', function () {
        const ymldata = `
            view:
                numb: 5
            definitions:
                numbpartial:
                    template: |
                        numb={{numb::integer}}
            template: |
                {{> numbpartial}}
        `;
        return Template.loadYaml(null, ymldata)
            .then((tmpl) => {
                assert.strictEqual(tmpl.render(), 'numb=5\n');
            });
    });
    it('render_empty_template', function () {
        const mstdata = '';
        const view = {};
        const reference = '';

        return Template.loadMst(null, mstdata)
            .then((tmpl) => {
                assert.strictEqual(tmpl.render(view), reference);
            });
    });
    it('render_inverted_section', function () {
        const mstdata = '{{^skip_foo}}foo{{/skip_foo}}{{^skip_bar}}bar{{/skip_bar}}';
        const view = { skip_foo: true };
        const reference = 'bar';

        return Template.loadMst(null, mstdata)
            .then((tmpl) => {
                console.log(JSON.stringify(tmpl.getViewSchema(), null, 2));
                assert.strictEqual(tmpl.render(view), reference);
            });
    });
    it('render_type_defaults', function () {
        const mstdata = '{{virtual_port:f5:port}}';
        const view = {};
        const reference = '443';

        return Template.loadMst(schemaProvider, mstdata)
            .then((tmpl) => {
                console.log(JSON.stringify(tmpl.getViewSchema(), null, 2));
                assert.strictEqual(tmpl.render(view), reference);
            });
    });
});
