'use strict';

const Ajv = require('ajv');
const Mustache = require('mustache');
const yaml = require('js-yaml');

const path = require('path');
const fs = require('fs');

// Setup validator
const _templateSchemaPath = path.join(__dirname, 'template_schema.yml');
const _validateSchema = (() => {
    const data = fs.readFileSync(_templateSchemaPath, 'utf8');

    const schema = yaml.safeLoad(data);
    const validator = new Ajv();

    // meta-schema uses a mustache format; just parse the string validate it
    validator.addFormat('mustache', {
        type: 'string',
        validate(input) {
            try {
                Mustache.parse(input);
                return true;
            } catch (e) {
                return false;
            }
        }
    });

    return validator.compile(schema);
})();

// Disable HTML escaping
Mustache.escape = function escape(text) {
    return text;
};

class Template {
    constructor() {
        this.title = '';
        this.description = '';
        this.definitions = {};
        this._viewSchema = {};
        this.target = 'as3';
        this.templateText = '';
    }

    _loadTypeSchemas(schemaProvider, schemaList) {
        const schemas = {};
        return Promise.all(schemaList.map(
            item => schemaProvider.fetch(item)
                .then((schema) => {
                    schemas[item] = JSON.parse(schema);
                })
        )).then(() => schemas);
    }

    _descriptionFromTemplate() {
        const tokens = Mustache.parse(this.templateText);
        const comments = tokens.filter(x => x[0] === '!');
        if (comments.length > 0) {
            this.description = comments[0][1];
        }
    }

    _handleParsed(parsed, typeSchemas) {
        const primitives = [
            'boolean',
            'object',
            'array',
            'number',
            'string',
            'integer',
            'text'
        ];

        const required = new Set();
        const schema = parsed.reduce((acc, curr) => {
            const [mstType, mstName] = [curr[0], curr[1]];
            switch (mstType) {
            case 'name': {
                const [defName, schemaName, type] = mstName.split(':');
                const defType = type || 'string';
                if (schemaName && typeof typeSchemas[schemaName] === 'undefined') {
                    throw new Error(`Failed to find the specified schema: ${schemaName}`);
                }
                if (!schemaName && primitives.indexOf(defType) === -1) {
                    throw new Error(`No schema definition for ${schemaName}/${defType}`);
                }

                if (schemaName) {
                    acc.properties[defName] = typeSchemas[schemaName].definitions[defType];
                    if (!acc.properties[defName]) {
                        throw new Error(`No definition for ${defType} in ${schemaName} schema`);
                    }
                } else {
                    acc.properties[defName] = {
                        type: defType
                    };
                }
                required.add(defName);
                break;
            }
            case '>': {
                const partial = this._handleParsed(Mustache.parse(this.definitions[mstName].template), typeSchemas);
                if (partial.properties) {
                    acc.properties[mstName] = partial;
                } else {
                    acc.properties['.'] = true;
                }
                required.add(mstName);
                break;
            }
            case '#': {
                const items = this._handleParsed(curr[4]);
                acc.properties[mstName] = {
                    type: 'array',
                    items,
                    label: 'iterator'
                };
                if (items.properties && Object.keys(items.properties) < 1) {
                    acc.properties.items = {
                        type: 'string',
                        label: 'primitive array member'
                    };
                }
                required.add(mstName);
                break;
            }
            case '!':
            case 'text':
                // skip
                break;
            default:
                // console.log(`skipping ${mstName} with type of ${mstType}`);
            }
            return acc;
        }, {
            type: 'object',
            properties: {}
        });
        if (schema.properties['.'] && Object.keys(schema.properties).length === 1) {
            return {
                type: 'string',
                label: 'dot reference'
            };
        }
        if (Object.keys(schema.properties).length < 1) {
            return {
                type: 'string',
                label: 'raw'
            };
        }
        schema.required = Array.from(required);
        return schema;
    }

    _viewSchemaFromTemplate(typeSchemas) {
        this._viewSchema = this._handleParsed(Mustache.parse(this.templateText), typeSchemas);
    }

    static loadMst(schemaProvider, msttext) {
        this.validate(msttext);
        const tmpl = new this();
        tmpl.templateText = msttext;
        return tmpl._loadTypeSchemas(schemaProvider, ['f5'])
            .then((typeSchemas) => {
                tmpl._descriptionFromTemplate();
                tmpl._viewSchemaFromTemplate(typeSchemas);

                return tmpl;
            });
    }

    static loadYaml(schemaProvider, yamltext) {
        this.validate(yamltext);
        const tmpl = new this();
        const yamldata = yaml.safeLoad(yamltext);
        tmpl.templateText = yamldata.template;

        if (yamldata.title) tmpl.title = yamldata.title;
        if (yamldata.description) tmpl.description = yamldata.description;
        if (yamldata.definitions) tmpl.definitions = yamldata.definitions;

        return tmpl._loadTypeSchemas(schemaProvider, ['f5'])
            .then((typeSchemas) => {
                tmpl._viewSchemaFromTemplate(typeSchemas);

                return tmpl;
            });
    }

    static isValid(tmpldata) {
        return _validateSchema(tmpldata);
    }

    static getValidationErrors() {
        return JSON.stringify(_validateSchema.errors, null, 2);
    }

    static validate(tmpldata) {
        if (!this.isValid(tmpldata)) {
            throw JSON.stringify(this.getValidationErrors(), null, 2);
        }
    }

    getViewSchema() {
        return this._viewSchema;
    }

    render(view) {
        return Mustache.render(this.templateText, view);
    }
}

module.exports = {
    Template
};
