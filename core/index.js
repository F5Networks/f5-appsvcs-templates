'use strict';

const FsSchemaProvider = require('./lib/schema_provider').FsSchemaProvider;
const { FsTemplateProvider } = require('./lib/template_provider');
const Template = require('./lib/template').Template;
const httpUtils = require('./lib/http_utils');
const { NullDriver, AS3Driver} = require('./lib/drivers');

module.exports = {
    FsSchemaProvider,
    FsTemplateProvider,
    Template,
    httpUtils,
    NullDriver,
    AS3Driver
};
