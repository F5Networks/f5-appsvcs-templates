/*
 * Copyright 2019. F5 Networks, Inc. See End User License Agreement ("EULA") for
 * license terms. Notwithstanding anything to the contrary in the EULA, Licensee
 * may copy and modify this software product for its internal business purposes.
 * Further, Licensee may upload, publish and distribute the modified version of
 * the software product on devcentral.f5.com.
 */

const fs = require('fs');
// const uuid = require('uuid/v4');
const mustache = require('mustache');
// const Ajv = require('ajv');
// const ajv = new Ajv({ useDefaults: true });
// const io = require('./io_util.js');

const getSimplifiedTemplate = function(templatesDir, name) {
    const template = fs.readFileSync(`${templatesDir}/${name}.mst`, 'utf8')
        .replace(/\n/g, '')                  // purge newlines
        .replace(/{{!.*?}}/g, '')            // purge comments
        .replace(/{{(.*?):.*?}}/g, '{{$1}}') // remove :type suffixes
        .replace(/{{(.*?)}}/g, '{{&$1}}');   // prevent html escaping
    return template;
};

const getTemplates = function(templatesDir) {
    const fileNames = fs.readdirSync(templatesDir);
    var templates = {};
    fileNames
        .filter(fileName => fileName.match(/.*\.mst$/))
        .forEach(fileName => {
            let name = fileName.slice(0, -4);
            templates[name] = fs.readFileSync(`${templatesDir}/${fileName}`, 'utf8');
        });
    return templates;
};

const getSchemas = function(schemasDir) {
    const fileNames = fs.readdirSync(schemasDir);
    var schemas = {};
    fileNames
        .filter(fileName => fileName.match(/.*\.json$/))
        .forEach(fileName => {
            let schemaName = fileName.slice(0, -5);
            schemas[schemaName] = fs.readFileSync(`${schemasDir}/${fileName}`, 'utf8');
        });
    return schemas;
};

const mapToForm = function(mustacheOutput, typeDefs) {
    var rval = [];
    var commentIndex = 1;
    mustacheOutput
        .filter(x => x[0] !== 'text')
        .forEach(x => {
            let formVar = {};
            if (x[0] === '!') {
                formVar.name = `comment_${commentIndex++}`;
                formVar.uiName = '';
                formVar.type = 'string';
                formVar.uiWidget = 'comment';
                formVar.value = x[1] || '';
                rval.push(formVar);
            } else {
                let y = x[1].split(':');
                if (y.length > 1) {
                    formVar.name = y[0] || 'undefined';
                    formVar.uiName = formVar.name.replace(/_/g, ' ');
                    formVar.type = y[1] || 'string';
                    if (typeDefs[formVar.type] !== undefined) {
                        Object.keys(typeDefs[formVar.type])
                            .filter(key => key !== 'type')
                            .forEach(key => {
                                formVar[key] = typeDefs[formVar.type][key];
                            });
                    }
                    formVar.value = y[2] || formVar.default || '';
                    formVar.uiWidget = formVar.uiWidget || 'input';
                    rval.push(formVar);
                }
            }
        });
    return rval;
};

const getForms = function(templatesDir, schemasDir) {
    const templates = getTemplates(templatesDir);
    const schemas = getSchemas(schemasDir);
    var typeDefs = {};
    var forms = {};
    Object.keys(schemas).forEach(schemaName => {
        let defs = JSON.parse(schemas[schemaName]).definitions || {};
        Object.keys(defs).forEach(type => {
            typeDefs[type] = defs[type];
        });
    });
    Object.keys(templates).forEach(formName => {
        forms[formName] = mapToForm(mustache.parse(templates[formName]), typeDefs);
    });
    return forms;
};

module.exports = {
    getSimplifiedTemplate,
    getForms
};
