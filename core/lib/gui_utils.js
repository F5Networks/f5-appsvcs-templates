'use strict';

const injectFormatsIntoSchema = (schema) => {
    Object.values(schema).forEach((item) => {
        if (item !== null && typeof item === 'object') {
            if (item.type === 'boolean') {
                item.format = 'checkbox';
            } else if (item.type === 'array') {
                item.format = 'table';
            }

            injectFormatsIntoSchema(item);
        }
    });
};

const addDepsToSchema = (schema) => {
    if (schema.dependencies) {
        Object.keys(schema.dependencies).forEach((key) => {
            const dependsOn = schema.dependencies[key][0];
            schema.properties[key].options = Object.assign({}, schema.properties[key].options, {
                dependencies: {
                    [dependsOn]: true
                }
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

module.exports = {
    injectFormatsIntoSchema,
    addDepsToSchema,
    modSchemaForJSONEditor
};
