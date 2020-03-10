'use strict';

const injectFormatsIntoSchema = (schema) => {
    Object.values(schema).forEach((item) => {
        if (item !== null && typeof item === 'object') {
            if (item.type === 'boolean') {
                item.format = 'checkbox';
            } else if (item.type === 'array') {
                item.format = 'table';
            } else if (item.format === 'text') {
                item.format = 'textarea';
            }

            injectFormatsIntoSchema(item);
        }
    });
};

const addDepsToSchema = (schema) => {
    if (schema.dependencies) {
        Object.keys(schema.dependencies).forEach((key) => {
            const depsOpt = schema.dependencies[key].reduce((acc, curr) => {
                acc[curr] = !(
                    schema.properties[key].invertDependency
                    && schema.properties[key].invertDependency.includes(curr)
                );
                return acc;
            }, {});
            schema.properties[key].options = Object.assign({}, schema.properties[key].options, {
                dependencies: depsOpt
            });
        });
    }
    if (schema.properties) {
        Object.values(schema.properties).forEach(item => addDepsToSchema(item));
    }
};

const modSchemaForJSONEditor = (schema) => {
    schema.title = schema.title || 'Template';
    injectFormatsIntoSchema(schema);
    addDepsToSchema(schema);
};

const filterExtraProperties = (view, schema) => {
    if (!schema.properties) {
        return {};
    }
    return Object.keys(view).reduce((acc, curr) => {
        if (schema.properties[curr] !== undefined) {
            acc[curr] = view[curr];
        }
        return acc;
    }, {});
};

module.exports = {
    injectFormatsIntoSchema,
    addDepsToSchema,
    modSchemaForJSONEditor,
    filterExtraProperties
};
