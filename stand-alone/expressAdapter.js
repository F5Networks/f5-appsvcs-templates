/* Copyright 2024 F5 Networks, Inc.
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

const url = require('url');

const axios = require('axios');
const express = require('express');
const http = require('http');
const https = require('https');

const certsUtils = require('./certsUtils');
const RestOperation = require('./restOperation');

// Global state for the server
const server = {};

function restOpFromRequest(req) {
    const restOp = new RestOperation();
    const uri = url.parse(req.url.replace('/mgmt/', '/'), true);
    const body = Object.keys(req.body).length !== 0 ? req.body : undefined;
    restOp.setUri(uri)
        .setBody(body)
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

function _createExpressApp(options) {
    options = options || {};
    const PARSER_SIZE_LIMIT = process.env.FAST_JSON_REQ_BODY_LIMIT || '1mb';
    const app = express();
    if (options.staticFiles) {
        app.use(express.static(options.staticFiles));
    }
    app.use(express.json({
        limit: PARSER_SIZE_LIMIT
    }));
    // Load any middleware
    if (options.middleware) {
        options.middleware.forEach(x => app.use(x));
    }
    return app;
}

function generateStubApp(worker, options) {
    const app = _createExpressApp(options);
    const uriPaths = [`/mgmt/${worker.WORKER_URI_PATH}`, ...worker.WORKER_ALT_URI_PATHS || []];
    uriPaths.forEach(workerUriPath => app.all(`${workerUriPath}/*`, (req, res, next) => Promise.resolve()
        .then(() => res.status(503).send({ message: `FAST ${workerUriPath} is in unhealthy state` }))
        .catch(next)));
    return Promise.resolve(app);
}

function generateApp(workers, options) {
    options = options || {};

    if (!Array.isArray(workers)) {
        workers = [workers];
    }

    // Create an express app
    const app = _createExpressApp(options);

    // Patch up the workers
    workers.forEach((worker) => {
        worker.logger = {
            severe: console.error,
            error: console.error,
            info: console.log,
            fine: console.log,
            finest: console.log,
            log: console.log
        };
        worker.completeRestOperation = () => {};
        worker.restHelper = {
            makeRestjavadUri() {}
        };
        worker.dependencies = [];
        const uriPaths = [`/mgmt/${worker.WORKER_URI_PATH}`, ...worker.WORKER_ALT_URI_PATHS || []];
        uriPaths.forEach(workerUriPath => app.all(`${workerUriPath}/*`, (req, res, next) => Promise.resolve()
            .then(() => getWorkerResponse(worker, req, res))
            .catch(next)));
    });

    // Create an endpoint to forward remaining requests to BIG-IP
    if (options.bigip) {
        options.bigip.username = options.bigip.username || options.bigip.user;
        const endpoint = axios.create({
            baseURL: options.bigip.host,
            auth: {
                username: options.bigip.username,
                password: options.bigip.password
            },
            maxBodyLength: 'Infinity',
            httpAgent: new http.Agent({
                keepAlive: false
            }),
            httpsAgent: new https.Agent({
                rejectUnauthorized: options.bigip.strictCerts,
                keepAlive: false
            })
        });
        app.all('/*', (req, res, next) => Promise.resolve()
            .then(() => {
                console.log(`forwarding request ${req.method}: ${req.url}`);
            })
            .then(() => endpoint.request({
                method: req.method,
                url: req.url,
                data: (Object.keys(req.body).length !== 0) ? req.body : undefined,
                headers: req.headers,
                validateStatus: () => true // pass on failures
            }))
            .then(epRsp => res
                .status(epRsp.status)
                .send(epRsp.data))
            .catch(next));
    }

    return Promise.all(workers.map(worker => Promise.resolve()
        .then(() => worker.onStart(
            () => {}, // success
            () => Promise.reject() // error
        ))
        .then(() => worker.onStartCompleted(
            () => {}, // success
            () => Promise.reject(), // error
            '', // loadedState
            '' // errMsg
        ))))
        .then(() => app);
}

function startHttpsServer(app, options) {
    const port = options.port || 8080;
    const allowLocalCert = options.allowLocalCert;

    stopHttpsServer();

    let certKeyChainConfig = {
        ca: process.env[options.tlsCaEnvName || 'F5_SERVICE_CA'] || null,
        cert: process.env[options.tlsCertEnvName || 'F5_SERVICE_CERT'] || null,
        key: process.env[options.tlsKeyEnvName || 'F5_SERVICE_KEY'] || null
    };

    let certKeyChain = certsUtils.readCertsChain(certKeyChainConfig);
    let errors = certKeyChain.errors;
    certKeyChain = certKeyChain.chain;

    // Grab from a dev location as a fallback
    if (allowLocalCert && (!certKeyChain.cert || !certKeyChain.key)) {
        // TODO: should CA be re-read then?
        certKeyChainConfig = {
            cert: options.tlsCertLocalName || 'certs/certificate.pem',
            key: options.tlsKeyLocalName || 'certs/key.pem'
        };

        certKeyChain = certsUtils.readCertsChain(certKeyChainConfig);
        if (certKeyChain.errors) {
            errors = `${errors}\n${certKeyChain.errors}`;
        }
        certKeyChain = certKeyChain.chain;
    }

    // TODO: should we check for CA errors?
    if (!certKeyChain.key || !certKeyChain.cert) {
        return Promise.reject(new Error(
            `Failed to load TLS key and certificate: ${errors}`
        ));
    }

    // Remove CA config if not defined
    if (!certKeyChainConfig.ca) {
        delete certKeyChainConfig.ca;
    }

    // Read the most recent modification time of config
    const mostRecentMtime = certsUtils.mostRecentMtime(certKeyChainConfig);

    // Create server and start listening
    try {
        server.server = https.createServer(certKeyChain, app);
        server.server.listen(port);
    } catch (err) {
        return Promise.reject(new Error(
            `Failed to start HTTP Server: ${err}`
        ));
    }

    if (mostRecentMtime < certsUtils.mostRecentMtime(certKeyChainConfig)) {
        // Reload cert/key if new ones are loaded during the execution of startHttpsServer
        certKeyChain = certsUtils.readCertsChain(certKeyChainConfig);
        if (certKeyChain.errors) {
            console.log(certKeyChain.errors);
            console.log('Certificate reload failed');
        } else {
            updateServerSecureContext(certKeyChain.chain);
        }
    }

    server.certsRotation = new certsUtils.CertsRotation(
        updateServerSecureContext,
        certKeyChainConfig,
        {
            maxPendingOps: options.certsRotationMaxPendingOps,
            waitTimeout: options.certsRotationWaitTimeout
        }
    );
    server.certsRotation.start();

    return Promise.resolve(server);
}

function stopHttpsServer() {
    if (server.server) {
        server.server.close();
        server.server = null;
    }

    if (server.certsRotation) {
        server.certsRotation.stop();
        server.certsRotation = null;
    }
}

function updateServerSecureContext(certKeyChain) {
    if (!server.server) {
        return;
    }
    try {
        server.server.setSecureContext(certKeyChain);
        console.log('Certificate reload complete');
    } catch (e) {
        console.log(e);
        console.log('Certificate reload failed');
    }
}

module.exports = {
    generateApp,
    startHttpsServer,
    stopHttpsServer,
    restOpFromRequest,
    setResponseFromRestOp,
    getWorkerResponse,
    generateStubApp
};
