/* eslint-disable no-console */

'use strict';

const path = require('path');
const url = require('url');

const express = require('express');

const RestOperation = require('./restOperation');

function restOpFromRequest(req) {
    const restOp = new RestOperation();
    const uri = url.parse(req.url.replace('/mgmt/', '/'));
    if (!uri.query) {
        uri.query = {};
    }
    restOp.setUri(url.parse(uri))
        .setBody(req.body);

    Object.keys(req.headers).forEach((headerName) => {
        restOp.setHeader(headerName, req.headers[headerName]);
    });


    return restOp;
}

function setResponseFromRestOp(restOp, res) {
    const body = restOp.getBody() || '';
    const headers = restOp.getHeaders() || {};

    Object.keys(headers).forEach((headerName) => {
        const header = headers[headerName];
        res.set(headerName, header);
    });

    res
        .status(restOp.getStatusCode())
        .send(body);
}


function getWorkerResponse(worker, req, res) {
    const restOp = restOpFromRequest(req);

    return Promise.resolve()
        .then(() => {
            switch (req.method) {
            case 'GET': return Promise.resolve('onGet');
            case 'POST': return Promise.resolve('onPost');
            case 'PUT': return Promise.resolve('onPut');
            case 'PATCH': return Promise.resolve('onPatch');
            case 'DELETE': return Promise.resolve('onDelete');
            default:
                return Promise.reject(new Error(
                    `Could not determine a worker method for HTTP method: ${req.method}`
                ));
            }
        })
        .then(fnName => worker[fnName](restOp))
        .then(() => setResponseFromRestOp(restOp, res))
        .catch((e) => {
            console.log(e.stack);
        });
}

function generateApp(worker) {
    // Patch up the worker
    worker.logger = {
        severe: console.error,
        error: console.error,
        info: console.log,
        fine: console.log,
        finest: console.log,
        log: console.log
    };
    worker.completeRestOperation = () => {};

    // Create an express app
    const app = express();
    app.use(express.static(path.join(__dirname, '../iappslx/presentation')));
    app.use(express.json());
    app.all(`/mgmt/${worker.WORKER_URI_PATH}/*`, (req, res, next) => Promise.resolve()
        .then(() => getWorkerResponse(worker, req, res))
        .catch(next));
    return Promise.resolve()
        .then(() => worker.onStart(
            () => {}, // success
            () => Promise.reject() // error
        ))
        .then(() => worker.onStartCompleted(
            () => {}, // success
            () => Promise.reject(), // error
            '', // loadedState
            '' // errMsg
        ))
        .then(() => app);
}

module.exports = {
    generateApp
};
