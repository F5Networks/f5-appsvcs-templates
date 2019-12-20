'use strict';

const Mustache = require('mustache');
const Ajv = require('ajv');
const uuid = require('uuid/v4');

const ajv = new Ajv({ coerceTypes: 'array', useDefaults: true });

Mustache.escape = function escape(text) {
    return text;
};

// template variable names that cannot be used because
// they have special meaning
const ignored = [
    'templateName',
    'uuid'
].reduce((acc, cur) => {
    acc[cur] = true;
    return acc;
}, {});

const templateToParams = (template) => {
    let description = '';
    return ((props) => {
        // console.log(props);
        const paramsTable = props.reduce((acc, cur) => {
            if (cur[0] === 'name' && !ignored[cur[1]]) {
                const param = cur[1].split(':');
                if (!acc[param[0]] || !acc[param[0]].includes(':')) acc[param[0]] = cur[1];
            } else if (cur[0] === '!' && description === '') {
                description = cur[1];
            }
            return acc;
        }, {});
        // console.log(paramsTable);
        return {
            params: paramsTable,
            description
        };
    })(Mustache.parse(template).filter(x => x[0] !== 'text'));
};

// create schema for AS3 template
const templateToSchema = (template, schema) => ((props) => {
    const propSchema = props.reduce((acc, cur) => {
        if (cur[0] === 'name') {
            const param = cur[1].split(':');
            // console.log('templateToSchema');
            // console.log(props);
            // console.log(param);
            // console.log(schema);
            let newDef;
            const definition = (() => {
                if (param[1]) {
                    // handle schema type lookup
                    newDef = schema[param[1]].definitions[param[2]];
                    if (!newDef) throw new Error(`No schema definition for ${param[1]}/${param[2]}`);
                    return newDef;
                }

                const primitives = [
                    'boolean',
                    'object',
                    'array',
                    'number',
                    'string',
                    'integer'
                ];

                newDef = { type: 'string' };

                if (param[2]) {
                    if (primitives.some(x => x === param[2])) {
                        newDef.type = param[2];
                    }

                    if (param[2] === 'text') {
                        newDef.contentMediaType = 'text/plain';
                    }
                }

                newDef.default = (() => {
                    if (newDef.type === 'array') return ['10.0.1.1'];
                    if (newDef.type === 'boolean') return true;
                    if (newDef.type === 'number'
                        || newDef.type === 'integer') return 131;
                    return 'myComponent';
                })(param);

                return newDef;
            })();

            // experimental: defaults for specific variable names
            // overrides what is in schema, currently.
            const defaultsTable = {
                tenant_name: 'myTenant',
                application_name: 'myApp',
                server_port: 443
            };
            if (defaultsTable[param[0]]) definition.default = defaultsTable[param[0]];

            if ((!acc[param[0]] || param[1]) && !ignored[param[0]]) acc[param[0]] = definition;
        }
        return acc;
    }, {});

    return {
        type: 'object',
        properties: propSchema,
        required: Object.keys(propSchema)
    };
})(Mustache.parse(template).filter(x => x[0] !== 'text'));

const HtmlTemplate = require('./html_engine.js').HtmlTemplate;

const formHtmlTemplate = new HtmlTemplate('form_html');

// used for as3 templates
function TemplateEngine(templateName, templateText, schemaSet) {
    this.templateName = templateName;
    this.schemaSet = schemaSet;
    this.as3_template = templateText;

    const schemaMetaData = templateToParams(this.as3_template);
    this.as3_params_table = schemaMetaData.params;
    this.template_description = schemaMetaData.description;

    this.as3_view_schema = templateToSchema(this.as3_template, schemaSet);
    this._validate = ajv.compile(this.as3_view_schema);

    this.fillDefaults = () => Object.keys(this.as3_view_schema.properties)
        .map((prop) => {
            const defn = this.as3_view_schema.properties[prop];
            const newView = {
                name: prop,
                required: this.as3_view_schema.required.some(k => k === prop) ? 'required' : null,
                type: (() => {
                    if (defn.enum) return 'enum';
                    return defn.contentMediaType || defn.type;
                })(),
                array: defn.type === 'array',
                value: defn.default,
                options: defn.enum || []
            };
            return newView;
        });

    // this is difficult to deal with because it has a function in it
    // hard to clone ... fix this, partials should be used
    const formHtmlView = {
        templateName: this.templateName,
        template_description: this.template_description,
        form_items: this.fillDefaults(),
        item_form_element() {
            const emap = {
                'text/plain': `<textarea rows="4" cols="50" name="${this.name}" ${this.required}></textarea>`,
                boolean: `<input type="checkbox" name="${this.name}">`,
                array: this.value instanceof Array
                    ? this.value.map(v => `<input type="text" name="${this.name}" value="${v}" ${this.required}>`).join('</div><div class="p_input">') : '',
                enum: [
                    `<select name="${this.name}">`,
                    this.options.map(x => `<option value="${x}">${x}</option>`).join(''),
                    '</select>'
                ].join('')
            };
            // console.log('type:', this.type, this.name);
            if (emap[this.type]) return emap[this.type];

            return `<input type="text" name="${this.name}" value="${this.value}" ${this.required}>`;
        }
    };
    this.formHtmlView = formHtmlView;
    this.formHtml = () => {
        delete formHtmlView.application_name;
        formHtmlView.form_items = this.fillDefaults();
        return formHtmlTemplate.render(formHtmlView);
    };
    return this;
}

TemplateEngine.prototype.loadWithDefaults = function loadWithDefaults(defaults) {
    if (!defaults) throw new Error('TemplateEngine.loadWithDefaults: null defaults!');
    const appFormView = this.formHtmlView;
    appFormView.form_items = this.fillDefaults();
    appFormView.form_items.forEach((e) => {
        e.value = defaults[e.name];
    });
    // console.log('lwd1', defaults);
    // console.log('lwd2', appFormView);
    appFormView.application_name = defaults.application_name;
    appFormView.targets = [defaults.target];
    // console.log(formHtmlTemplate.html_template);
    // console.log(appFormView);
    // console.log('loadWithDefaults', defaults);
    const appEditForm = formHtmlTemplate.render(appFormView);
    // console.log(appEditForm);
    return appEditForm;
};

TemplateEngine.prototype.validate = function validate(input) {
    const valid = this._validate(input);
    if (valid) return null;
    return this._validate.errors;
};

TemplateEngine.prototype.render = function render(input) {
    console.log('templat render input', input);
    const view = Object.keys(this.as3_view_schema.properties).reduce((acc, key) => {
        // //console.log(key);
        const text = input[key];
        // this translates simple variable names into
        // fully specified types for the template replacement
        const viewParam = this.as3_params_table[key];
        if (!viewParam) return acc;
        const typeInfo = viewParam.split(':');

        if (typeInfo[2]) {
            if (typeInfo[2] === 'number'
                || typeInfo[2] === 'boolean') {
                acc[viewParam] = text;
            } else {
                acc[viewParam] = JSON.stringify(text);
            }
        } else {
            acc[viewParam] = text;
        }
        return acc;
    }, {
        templateName: this.templateName
    });

    Object.assign(view, input);

    if (!view.uuid || view.uuid === '') view.uuid = uuid().substring(0, 8);

    console.log('template view', view);
    // console.log(this.as3_template);
    console.log('uuid', view.uuid);
    const text = Mustache.render(this.as3_template, view);
    const as3 = (() => {
        try {
            return JSON.parse(text);
        } catch (e) {
            console.log(text);
            throw new Error([`Rendered template is not valid jason${this.templateName}`, JSON.stringify(view), text].join('\n'));
        }
    })();
    console.log(text);
    const _adc = as3.class === 'AS3' ? as3.declaration : as3;

    Object.keys(_adc).filter(k => _adc[k].class === 'Tenant')
        .forEach((k) => {
            console.log('tenant', k);
            Object.keys(_adc[k])
                .filter(a => _adc[k][a].class === 'Application')
                .forEach((a) => {
                    console.log('The rendered application name is authoritative:', a);
                    if (!input.application_name) input.application_name = a;

                    const as3Constants = Object.assign({
                        class: 'Constants',
                        application_name: a,
                        uuid: view.uuid
                    }, input);

                    _adc[k][a].label = this.templateName;
                    _adc[k][a].constants = as3Constants;

                    console.log('_adc should have constants included');
                    console.log(_adc[k][a].constants);

                    if (input.application_name && a !== input.application_name) {
                        _adc[k][input.application_name] = _adc[k][a];
                        delete _adc[k][a];
                    }
                });
        });
    return as3;
};

module.exports = {
    TemplateEngine
};
