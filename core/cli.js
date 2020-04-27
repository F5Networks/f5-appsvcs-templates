#!/usr/bin/env node

'use strict';

/* eslint-disable no-console */

const fs = require('fs').promises;
const path = require('path');

const Template = require('./lib/template').Template;
const FsTemplateProvider = require('./lib/template_provider').FsTemplateProvider;
const generateHtmlPreview = require('./lib/gui_utils').generateHtmlPreview;

const loadTemplate = (templatePath) => {
    const tmplName = path.basename(templatePath, path.extname(templatePath));
    const tsName = path.basename(path.dirname(templatePath));
    const tsDir = path.dirname(path.dirname(templatePath));
    const provider = new FsTemplateProvider(tsDir, [tsName]);
    return provider.fetch(`${tsName}/${tmplName}`)
        .catch((e) => {
            console.error(Template.getValidationErrors());
            console.error(`failed to load template: ${e.stack}`);
            process.exit(1);
        });
};

const loadParameters = (parametersPath) => {
    if (!parametersPath) return Promise.resolve({});
    return fs.readFile(parametersPath, 'utf8')
        .then(paramsData => JSON.parse(paramsData));
};

const loadTemplateAndParameters = (templatePath, parametersPath) => Promise.all([
    loadTemplate(templatePath),
    loadParameters(parametersPath)
]);

const validateTemplate = templatePath => loadTemplate(templatePath)
    .then(() => {
        console.log(`template source at ${templatePath} is valid`);
    });

const templateToParametersSchema = templatePath => loadTemplate(templatePath)
    .then((tmpl) => {
        console.log(JSON.stringify(tmpl.getParametersSchema(), null, 2));
    });

const validateParamData = (tmpl, parameters) => {
    try {
        tmpl.validateParameters(parameters);
    } catch (e) {
        console.error('parameters failed validation:');
        if (e.stack) {
            console.error(e.stack);
        } else {
            console.error(e);
        }
        process.exit(1);
    }
};

const validateParameters = (templatePath, parametersPath) => loadTemplateAndParameters(templatePath, parametersPath)
    .then(([tmpl, parameters]) => {
        validateParamData(tmpl, parameters);
    });

const renderTemplate = (templatePath, parametersPath) => loadTemplateAndParameters(templatePath, parametersPath)
    .then(([tmpl, parameters]) => {
        validateParamData(tmpl, parameters);
        console.log(tmpl.render(parameters));
    });

const validateTemplateSet = (tsPath) => {
    const tsName = path.basename(tsPath);
    const tsDir = path.dirname(tsPath);
    const provider = new FsTemplateProvider(tsDir, [tsName]);
    return provider.list()
        .then(templateList => Promise.all(templateList.map(tmpl => provider.fetch(tmpl))))
        .catch((e) => {
            console.error(`Template set "${tsName}" failed validation:\n${e.stack}`);
            process.exit(1);
        });
};

const htmlPreview = (templatePath, parametersPath) => loadTemplateAndParameters(templatePath, parametersPath)
    .then(([tmpl, parameters]) => generateHtmlPreview(
        tmpl.getParametersSchema(),
        tmpl.getCombinedParameters(parameters)
    ))
    .then(htmlData => console.log(htmlData));

const packageTemplateSet = (tsPath, dst) => validateTemplateSet(tsPath)
    .then(() => {
        const tsName = path.basename(tsPath);
        const tsDir = path.dirname(tsPath);
        const provider = new FsTemplateProvider(tsDir, [tsName]);

        dst = dst || `./${tsName}.zip`;

        return provider.buildPackage(tsName, dst)
            .then(() => {
                console.log(`Template set "${tsName}" packaged as ${dst}`);
            });
    });


/* eslint-disable-next-line no-unused-expressions */
require('yargs')
    .command('validate <file>', 'validate given template source file', (yargs) => {
        yargs
            .positional('file', {
                describe: 'template source file to validate'
            });
    }, argv => validateTemplate(argv.file))
    .command('schema <file>', 'get template parameter schema for given template source file', (yargs) => {
        yargs
            .positional('file', {
                describe: 'template source file to parse'
            });
    }, argv => templateToParametersSchema(argv.file))
    .command('validateParameters <tmplFile> <parameterFile>', 'validate supplied template parameters with given template', (yargs) => {
        yargs
            .positional('tmplFile', {
                describe: 'template to get template parameters schema from'
            })
            .positional('parameterFile', {
                describe: 'file with template parameters to validate'
            });
    }, argv => validateParameters(argv.tmplFile, argv.parameterFile))
    .command('render <tmplFile> [parameterFile]', 'render given template file with supplied parameters', (yargs) => {
        yargs
            .positional('tmplFile', {
                describe: 'template source file to render'
            })
            .positional('parameterFile', {
                describe: 'optional file with template parameters to use in addition to any defined in the parameters in the template source file'
            });
    }, argv => renderTemplate(argv.tmplFile, argv.parameterFile))
    .command('validateTemplateSet <templateSetPath>', 'validate supplied template set', (yargs) => {
        yargs
            .positional('templateSetPath', {
                describe: 'path to the directory containing template sources'
            });
    }, argv => validateTemplateSet(argv.templateSetPath))
    .command('htmlpreview <tmplFile> [parameterFile]', 'generate a static HTML file with a preview editor to standard out', (yargs) => {
        yargs
            .positional('tmplFile', {
                describe: 'template source file to render'
            })
            .positional('parameterFile', {
                describe: 'optional file with template parameters to use in addition to any defined in the parameters in the template source file'
            });
    }, argv => htmlPreview(argv.tmplFile, argv.parameterFile))
    .command('packageTemplateSet <templateSetPath> [dst]', 'build a package for a given template set', (yargs) => {
        yargs
            .positional('templateSetPath', {
                describe: 'path to the directory containing template sources'
            })
            .positional('dst', {
                describe: 'optional location for the built package (defaults to the current working directory)'
            });
    }, argv => packageTemplateSet(argv.templateSetPath, argv.dst))
    .demandCommand(1, 'A command is required')
    .wrap(120)
    .strict()
    .argv;
