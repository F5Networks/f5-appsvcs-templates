'use strict';

const dataStores = require('atg-storage');

const FsSchemaProvider = require('./lib/schema_provider').FsSchemaProvider;
const { FsTemplateProvider, DataStoreTemplateProvider } = require('./lib/template_provider');
const Template = require('./lib/template').Template;
const httpUtils = require('./lib/http_utils');
const { NullDriver, AS3Driver, AS3DriverConstantsKey } = require('./lib/drivers');
const guiUtils = require('./lib/gui_utils');

module.exports = {
    FsSchemaProvider,
    FsTemplateProvider,
    DataStoreTemplateProvider,
    Template,
    httpUtils,
    NullDriver,
    AS3Driver,
    AS3DriverConstantsKey,
    guiUtils,
    dataStores
};
