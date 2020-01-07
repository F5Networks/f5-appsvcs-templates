#!/usr/bin/env node

'use strict';

/* eslint-disable no-console */

const fs = require('fs').promises;
const path = require('path');

const Template = require('./lib/template').Template;
const FsSchemaProvider = require('./lib/schema_provider').FsSchemaProvider;

const schemaPath = path.join(__dirname, '..', 'schemas');
const schemaProvider = new FsSchemaProvider(schemaPath);

const loadTemplate = (templatePath) => {
    const tmplExt = templatePath.split('.').pop();
    return fs.readFile(templatePath, 'utf8')
        .then((tmplData) => {
            try {
                if (tmplExt === 'mst') {
                    return Template.loadMst(schemaProvider, tmplData);
                }
                return Template.loadYaml(schemaProvider, tmplData);
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

const validateTemplate = templatePath => loadTemplate(templatePath)
    .then(() => {
        console.log(`template at ${templatePath} is valid`);
    });

const templateToViewSchema = templatePath => loadTemplate(templatePath)
    .then((tmpl) => {
        console.log(JSON.stringify(tmpl.getViewSchema(), null, 2));
    });

const renderTemplate = (templatePath, viewPath) => loadTemplate(templatePath)
    .then((tmpl) => {
        const view = (viewPath) ? JSON.parse(fs.readFileSync(viewPath, 'utf8')) : {};
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
