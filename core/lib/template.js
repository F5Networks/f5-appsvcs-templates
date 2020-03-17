'use strict';

const crypto = require('crypto');

const Ajv = require('ajv');
const Mustache = require('mustache');
const yaml = require('js-yaml');

const _templateSchemaData = require('./template_schema').schema;

// Setup validator
const tmplSchema = yaml.safeLoad(_templateSchemaData);
const validator = new Ajv();

// meta-schema uses a mustache format; just parse the string validate it
validator.addFormat('mustache', {
    type: 'string',
    validate(input) {
        try {
            Mustache.parse(input);
            return true;
        } catch (e) {
            // TODO find a better way to report issues here
            console.log(e); /* eslint-disable-line no-console */
            return false;
        }
    }
});
const _validateSchema = validator.compile(tmplSchema);

class JSONViewTransform {
    transform(schema, value) {
        if (typeof value === 'undefined') {
            return value;
        }

        if (schema.type === 'array' && value.length && value.length > 0 && !schema.skip_xform) {
            return JSON.stringify(value);
        }

        if (schema.format === 'text' && value) {
            return JSON.stringify(value);
        }

        return value;
    }
}

// Disable HTML escaping
Mustache.escape = function escape(text) {
    return text;
};

class Template {
    constructor() {
        this.title = '';
        this.description = '';
        this.definitions = {};
        this.typeDefinitions = {};
        this._viewSchema = {};
        this.target = 'as3';
        this.templateText = '';
        this.defaultView = {};
        this.sourceType = 'UNKNOWN';
        this.sourceText = '';
        this.sourceHash = '';
    }

    _loadTypeSchemas(schemaProvider) {
        if (!schemaProvider) {
            return Promise.resolve({});
        }

        return schemaProvider.list()
            .then(schemaList => Promise.all(
                schemaList.map(x => Promise.all([Promise.resolve(x), schemaProvider.fetch(x)]))
            ))
            .then(schemas => schemas.reduce((acc, curr) => {
                const [schemaName, schema] = curr;
                acc[schemaName] = JSON.parse(schema);
                return acc;
            }, {}));
    }

    _descriptionFromTemplate() {
        const tokens = Mustache.parse(this.templateText);
        const comments = tokens.filter(x => x[0] === '!');
        if (comments.length > 0) {
            this.description = comments[0][1];
        }
    }

    _mergeSchemaInto(dst, src, dstDeps) {
        if (!src.properties) {
            // Nothing to merge
            return;
        }

        // Filter out properties we do not want to overwrite
        src.properties = Object.keys(src.properties).reduce((filtered, prop) => {
            const propDef = src.properties[prop];
            const noOverwrite = (
                dst.properties && dst.properties[prop] && dst.properties[prop].type
                && (dst.properties[prop].type === 'array' || dst.properties[prop].type === 'string')
                && propDef.type && propDef.type === 'boolean'
            );
            if (!noOverwrite) {
                filtered[prop] = propDef;
            }
            return filtered;
        }, {});

        // Merge properties
        Object.assign(dst.properties, src.properties);

        // Merge dependencies
        Object.keys(src.dependencies || []).forEach((dep) => {
            if (typeof dstDeps[dep] === 'undefined') {
                dstDeps[dep] = src.dependencies[dep];
            } else {
                dstDeps[dep] = dstDeps[dep].concat(src.dependencies[dep]);
            }
        });
    }

    _handleParsed(parsed, typeSchemas) {
        const primitives = {
            boolean: false,
            object: {},
            number: 0,
            string: '',
            integer: 0,
            array: [],
            text: ''
        };

        const required = new Set();
        const dependencies = {};
        const schema = parsed.reduce((acc, curr) => {
            const [mstType, mstName] = [curr[0], curr[1]];
            switch (mstType) {
            case 'name': {
                const [defName, schemaName, type] = mstName.split(':');
                const defType = type || 'string';
                if (schemaName && typeof typeSchemas[schemaName] === 'undefined') {
                    throw new Error(`Failed to find the specified schema: ${schemaName}`);
                }
                if (!schemaName && typeof primitives[defType] === 'undefined') {
                    throw new Error(`No schema definition for ${schemaName}/${defType}`);
                }

                if (schemaName) {
                    const schemaDef = typeSchemas[schemaName].definitions[defType];
                    acc.properties[defName] = Object.assign({}, schemaDef);
                    if (!acc.properties[defName]) {
                        throw new Error(`No definition for ${defType} in ${schemaName} schema`);
                    }
                    this.definitions[defType] = Object.assign({}, schemaDef, this.definitions[defType]);
                    this.typeDefinitions[defType] = Object.assign({}, schemaDef);
                } else if (defType === 'text') {
                    acc.properties[defName] = {
                        type: 'string',
                        format: 'text'
                    };
                } else if (defType === 'array') {
                    acc.properties[defName] = {
                        type: defType,
                        items: {
                            type: 'string'
                        }
                    };
                } else {
                    acc.properties[defName] = {
                        type: defType
                    };
                }
                if (this.definitions[defName]) {
                    Object.assign(acc.properties[defName], this.definitions[defName]);
                }
                if (acc.properties[defName].default === undefined) {
                    required.add(defName);
                }
                break;
            }
            case '>': {
                const partial = this._handleParsed(Mustache.parse(this.definitions[mstName].template), typeSchemas);
                this._mergeSchemaInto(acc, partial, dependencies);
                if (partial.required) {
                    partial.required.forEach(x => required.add(x));
                }
                if (partial.dependencies) {
                    Object.keys(partial.dependencies).forEach((prop) => {
                        dependencies[prop] = partial.dependencies[prop];
                    });
                }
                break;
            }
            case '#': {
                const items = this._handleParsed(curr[4], typeSchemas);
                const dotItems = curr[4].filter(item => item[0] === 'name' && item[1] === '.');
                const asArray = dotItems.length !== 0;
                const typeDefined = (
                    items.properties
                    && items.properties[mstName]
                    && items.properties[mstName].type
                    && items.properties[mstName].type === 'string'
                );
                if (asArray) {
                    acc.properties[mstName] = {
                        type: 'array',
                        skip_xform: true,
                        items
                    };
                    if (items.properties && Object.keys(items.properties) < 1) {
                        acc.properties.items = {
                            type: 'string'
                        };
                    }
                } else if (typeDefined) {
                    acc.properties[mstName] = items.properties[mstName];
                } else {
                    acc.properties[mstName] = {
                        type: 'boolean'
                    };
                }

                if (this.definitions[mstName]) {
                    Object.assign(acc.properties[mstName], this.definitions[mstName]);
                }

                required.add(mstName);

                if (items.properties) {
                    Object.keys(items.properties).forEach((item) => {
                        if (!dependencies[item]) {
                            dependencies[item] = [];
                        }
                        dependencies[item].push(mstName);
                    });
                }
                this._mergeSchemaInto(acc, items, dependencies);
                break;
            }
            case '^': {
                const items = this._handleParsed(curr[4], typeSchemas);

                if (!acc.properties[mstName]) {
                    acc.properties[mstName] = {
                        type: 'boolean'
                    };
                }
                if (items.properties) {
                    Object.keys(items.properties).forEach((item) => {
                        if (!dependencies[item]) {
                            dependencies[item] = [];
                        }
                        dependencies[item].push(mstName);
                        if (!items.properties[item].invertDependency) {
                            items.properties[item].invertDependency = [];
                        }
                        items.properties[item].invertDependency.push(mstName);
                    });
                }

                if (this.definitions[mstName]) {
                    Object.assign(acc.properties[mstName], this.definitions[mstName]);
                }
                this._mergeSchemaInto(acc, items, dependencies);
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
                default: primitives.string
            };
        }
        if (Object.keys(schema.properties).length < 1) {
            return {
                type: 'string',
                default: primitives.string
            };
        }
        // Set default values for any primitives
        Object.keys(schema.properties).forEach((prop) => {
            const def = schema.properties[prop];
            if (typeof def.default === 'undefined' && typeof primitives[def.type] !== 'undefined') {
                schema.properties[prop].default = primitives[def.type];
            }
        });

        // Get propertyOrder from definition if available
        Object.values(schema.properties).forEach((schemaDef) => {
            schemaDef.propertyOrder = 1000;
        });
        Object.keys(this.definitions).forEach((prop, idx) => {
            const schemaDef = schema.properties[prop];
            if (!schemaDef) {
                return;
            }
            schemaDef.propertyOrder = idx;
        });

        // Re-sort properties based on propertyOrder
        schema.properties = Object.entries(schema.properties)
            .map(([key, def]) => Object.assign({ name: key }, def))
            .sort((a, b) => a.propertyOrder - b.propertyOrder)
            .reduce((acc, curr) => {
                acc[curr.name] = curr;
                delete curr.name;
                delete curr.propertyOrder;
                return acc;
            }, {});

        // Remove any required items from dependencies
        required.forEach((value) => {
            delete dependencies[value];
        });

        // Add required and dependencies to the schema
        schema.required = Array.from(required);
        if (dependencies && Object.keys(dependencies).length > 0) {
            schema.dependencies = dependencies;
        }
        return schema;
    }

    _viewSchemaFromTemplate(typeSchemas) {
        this._viewSchema = this._handleParsed(Mustache.parse(this.templateText), typeSchemas);

        // If we just ended up with an empty string type, then we have no types and we
        // should return an empty object instead.
        if (this._viewSchema.type === 'string' && !this._viewSchema.properties) {
            this._viewSchema.type = 'object';
        }
    }

    _recordSource(sourceType, sourceText) {
        const hash = crypto.createHash('sha256');
        hash.update(sourceText);

        this.sourceType = sourceType;
        this.sourceText = sourceText;
        this.sourceHash = hash.digest('hex');
    }

    static loadMst(msttext, schemaProvider) {
        this.validate(msttext);
        const tmpl = new this();
        tmpl._recordSource('MST', msttext);
        tmpl.templateText = msttext;
        return tmpl._loadTypeSchemas(schemaProvider)
            .then((typeSchemas) => {
                tmpl._descriptionFromTemplate();
                tmpl._viewSchemaFromTemplate(typeSchemas);

                return tmpl;
            });
    }

    static loadYaml(yamltext, schemaProvider) {
        this.validate(yamltext);
        const tmpl = new this();
        const yamldata = yaml.safeLoad(yamltext);
        tmpl._recordSource('YAML', yamltext);
        tmpl.templateText = yamldata.template;

        if (yamldata.title) tmpl.title = yamldata.title;
        if (yamldata.description) tmpl.description = yamldata.description;
        if (yamldata.definitions) tmpl.definitions = yamldata.definitions;
        if (yamldata.view) tmpl.defaultView = yamldata.view;

        return tmpl._loadTypeSchemas(schemaProvider)
            .then((typeSchemas) => {
                tmpl._viewSchemaFromTemplate(typeSchemas);

                return tmpl;
            });
    }

    static fromJson(obj) {
        if (typeof obj === 'string') {
            obj = JSON.parse(obj);
        }
        const tmpl = new this();
        Object.assign(tmpl, obj);
        return tmpl;
    }

    static isValid(tmpldata) {
        return _validateSchema(tmpldata);
    }

    static getValidationErrors() {
        return JSON.stringify(_validateSchema.errors, null, 2);
    }

    static validate(tmpldata) {
        if (!this.isValid(tmpldata)) {
            throw new Error(this.getValidationErrors());
        }
    }

    getViewSchema() {
        return Object.assign({}, this._viewSchema, {
            title: this.title,
            description: this.description,
            definitions: this.typeDefinitions
        });
    }

    getCombinedView(view) {
        const typeProps = this.getViewSchema().properties;
        const typeDefaults = typeProps && Object.keys(typeProps).reduce((acc, key) => {
            const value = typeProps[key];
            if (value.default !== undefined) {
                acc[key] = value.default;
            }
            return acc;
        }, {});
        return Object.assign({}, typeDefaults || {}, this.defaultView, view || {});
    }

    _getPartials() {
        return Object.keys(this.definitions).reduce((acc, curr) => {
            const def = this.definitions[curr];
            if (def.template) {
                acc[curr] = this._cleanTemplateText(def.template);
            }
            return acc;
        }, {});
    }

    validateView(view) {
        const combView = this.getCombinedView(view);

        const viewValidator = new Ajv({
            unknownFormats: 'ignore'
        }).compile(this.getViewSchema());
        if (!viewValidator(combView)) {
            throw new Error(JSON.stringify(viewValidator.errors, null, 2));
        }
    }

    transformView(view) {
        const schema = this.getViewSchema();
        const transform = new JSONViewTransform();
        return Object.keys(view).reduce((acc, curr) => {
            const value = view[curr];
            const valueSchema = schema.properties && schema.properties[curr];

            if (valueSchema) {
                acc[curr] = transform.transform(valueSchema, value);
            } else {
                // Skip transform if we do not have schema
                acc[curr] = value;
            }
            return acc;
        }, {});
    }

    _cleanTemplateText(text) {
        return text.replace(/{{([_a-zA-Z0-9]+):.*}}/g, '{{$1}}');
    }

    render(view) {
        this.validateView(view);
        const xfview = this.transformView(this.getCombinedView(view));
        const partials = this._getPartials();
        return Mustache.render(this._cleanTemplateText(this.templateText), xfview, partials);
    }
}

module.exports = {
    Template
};
