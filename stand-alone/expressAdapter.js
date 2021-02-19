/* Copyright 2021 F5 Networks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */

'use strict';

const path = require('path');
const url = require('url');

const axios = require('axios');
const express = require('express');
const http = require('http');
const https = require('https');

const RestOperation = require('./restOperation');

function restOpFromRequest(req) {
    const restOp = new RestOperation();
    const uri = url.parse(req.url.replace('/mgmt/', '/'));
    if (!uri.query) {
        uri.query = {};
    }
    restOp.setUri(url.parse(uri))
        .setBody(req.body)
        .setMethod(RestOperation.Methods[req.method]);

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

    // Create an endpoint to forward remaining requests to BIG-IP
    let strictCerts = process.env.FAST_BIGIP_STRICT_CERT || true;
    if (typeof strictCerts === 'string') {
        strictCerts = (
            strictCerts.toLowerCase() === 'true'
            || strictCerts === '1'
        );
    }
    const endpoint = axios.create({
        baseURL: process.env.FAST_BIGIP_HOST,
        auth: {
            username: process.env.FAST_BIGIP_USER,
            password: process.env.FAST_BIGIP_PASSWORD
        },
        maxBodyLength: 'Infinity',
        httpAgent: new http.Agent({
            keepAlive: false
        }),
        httpsAgent: new https.Agent({
            rejectUnauthorized: strictCerts,
            keepAlive: false
        })
    });


    // Create an express app
    const app = express();
    app.use(express.static(path.join(__dirname, '../iappslx/presentation')));
    app.use(express.json());
    app.all(`/mgmt/${worker.WORKER_URI_PATH}/*`, (req, res, next) => Promise.resolve()
        .then(() => getWorkerResponse(worker, req, res))
        .catch(next));
    app.all('/*', (req, res, next) => Promise.resolve()
        .then(() => {
            console.log(`forwarding request ${req.method}: ${req.url}`);
        })
        .then(() => endpoint.request({
            method: req.method,
            url: req.url
        }))
        .then(epRsp => res
            .status(epRsp.status)
            .send(epRsp.data))
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
