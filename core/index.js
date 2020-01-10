'use strict';

const FsSchemaProvider = require('./lib/schema_provider').FsSchemaProvider;
const { FsTemplateProvider } = require('./lib/template_provider');
const Template = require('./lib/template').Template;

module.exports = {
    FsSchemaProvider,
    FsTemplateProvider,
    Template
};
