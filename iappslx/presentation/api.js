'use strict';

const SwaggerUI = require('swagger-ui');
const specData = require('./openapi.json');

SwaggerUI({
    dom_id: '#api',
    spec: specData
});
