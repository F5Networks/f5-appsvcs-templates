#!/usr/bin/env node

'use strict';

/* eslint-disable no-console */

const fs = require('fs').promises;
const path = require('path');

const Template = require('./lib/template').Template;
const FsSchemaProvider = require('./lib/schema_provider').FsSchemaProvider;

const schemaPath = path.join(__dirname, '..', 'templates', 'f5-debug');
const schemaProvider = new FsSchemaProvider(schemaPath);

const loadTemplate = (templatePath) => {
    const tmplExt = templatePath.split('.').pop();
    return fs.readFile(templatePath, 'utf8')
        .then((tmplData) => {
            try {
                if (tmplExt === 'mst') {
                    return Template.loadMst(tmplData, schemaProvider);
                }
                return Template.loadYaml(tmplData, schemaProvider);
            } catch (e) {
                if (!Template.isValid(tmplData)) {
                    console.error(`template at ${templatePath} failed validation:`);
                    console.error(`${Template.getValidationErrors()}`);
                } else {
                    console.error(`failed to load template: ${e.message}`);
                }
                process.exit(1);
                return null;
            }
        });
};

const loadView = (viewPath) => {
    if (!viewPath) return Promise.resolve({});
    return fs.readFile(viewPath, 'utf8')
        .then(viewData => JSON.parse(viewData));
};

const loadTemplateAndView = (templatePath, viewPath) => Promise.all([
    loadTemplate(templatePath),
    loadView(viewPath)
]);

const validateTemplate = templatePath => loadTemplate(templatePath)
    .then(() => {
        console.log(`template at ${templatePath} is valid`);
    });

const templateToViewSchema = templatePath => loadTemplate(templatePath)
    .then((tmpl) => {
        console.log(JSON.stringify(tmpl.getViewSchema(), null, 2));
    });

const validateViewData = (tmpl, view) => {
    try {
        tmpl.validateView(view);
    } catch (e) {
        console.error('view failed validation:');
        console.error(`${e.message}`);
        process.exit(1);
    }
};

const validateView = (templatePath, viewPath) => loadTemplateAndView(templatePath, viewPath)
    .then(([tmpl, view]) => {
        validateViewData(tmpl, view);
    });

const renderTemplate = (templatePath, viewPath) => loadTemplateAndView(templatePath, viewPath)
    .then(([tmpl, view]) => {
        validateViewData(tmpl, view);
        console.log(tmpl.render(view));
    });


/* eslint-disable-next-line no-unused-expressions */
require('yargs')
    .command('validate <file>', 'validate given template file', (yargs) => {
        yargs
            .positional('file', {
                describe: 'template file to validate'
            });
    }, argv => validateTemplate(argv.file))
    .command('schema <file>', 'get view schema for given template file', (yargs) => {
        yargs
            .positional('file', {
                describe: 'template file to parse'
            });
    }, argv => templateToViewSchema(argv.file))
    .command('validateView <tmplFile> <viewFile>', 'validate supplied view with given template', (yargs) => {
        yargs
            .positional('tmplFile', {
                describe: 'template to get view schema from'
            })
            .positional('viewFile', {
                describe: 'view file validate'
            });
    }, argv => validateView(argv.tmplFile, argv.viewFile))
    .command('render <tmplFile> [viewFile]', 'render given template file with supplied view', (yargs) => {
        yargs
            .positional('tmplFile', {
                describe: 'template to render'
            })
            .positional('viewFile', {
                describe: 'optional view file to use in addition to any defined view in the template file'
            });
    }, argv => renderTemplate(argv.tmplFile, argv.viewFile))
    .demandCommand(1, 'A command is required')
    .strict()
    .argv;
