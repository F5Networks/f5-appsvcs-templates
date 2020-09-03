#!/usr/bin/env node
/* eslint-disable no-console */

'use strict';

const https = require('https');

const bigipTarget = process.env.BIGIP_TARGET;
const bigipCreds = process.env.BIGIP_CREDS;
const MAX_TENANTS = process.env.MAX_TENANTS || 5;
const NUM_APPS = process.env.NUM_APPS || 50;

if (!bigipTarget) {
    throw new Error('BIGIP_TARGET env var needs to be defined');
}

if (!bigipCreds) {
    throw new Error('BIGIP_CREDS env var needs to be defined');
}

function doRequest(opts, payload) {
    const [host, port] = bigipTarget.split(':');
    const defaultOpts = {
        host,
        port: port || 80,
        rejectUnauthorized: false,
        headers: {
            Authorization: `Basic ${Buffer.from(bigipCreds).toString('base64')}`,
            'Content-Type': 'application/json'
        }
    };
    const combOpts = Object.assign({}, defaultOpts, opts);

    return new Promise((resolve, reject) => {
        const req = https.request(combOpts, (res) => {
            const buffer = [];
            res.setEncoding('utf8');
            res.on('data', (data) => {
                buffer.push(data);
            });
            res.on('end', () => {
                let body = buffer.join('');
                body = body || '{}';
                try {
                    body = JSON.parse(body);
                } catch (e) {
                    return reject(new Error(`Invalid response object from ${combOpts.method} to ${combOpts.path}`));
                }
                return resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body
                });
            });
        });

        req.on('error', (e) => {
            reject(new Error(`${opts.host}:${e.message}`));
        });

        if (payload) req.write(JSON.stringify(payload));
        req.end();
    });
}

function doGet(path) {
    return doRequest({ path, method: 'GET' });
}

function doPost(path, payload) {
    return doRequest({ path, method: 'POST' }, payload);
}

function doDelete(path) {
    return doRequest({ path, method: 'DELETE' });
}

function promiseDelay(timems) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), timems);
    });
}

function waitForCompletedTask(taskid) {
    if (!taskid) {
        return Promise.reject(new Error('failed to get a taskid'));
    }

    console.log(`Waiting for taskid ${taskid} to complete...`);
    return Promise.resolve()
        .then(() => doGet(`/mgmt/shared/fast/tasks/${taskid}`))
        .then((response) => {
            if (response.body.code === 0) {
                return promiseDelay(1000)
                    .then(() => waitForCompletedTask(taskid));
            }
            if (response.body.code !== 200) {
                return Promise.reject(
                    new Error(response.body.message)
                );
            }
            return response.body;
        });
}

function createApplication(id) {
    const templateName = (id % 2 === 0) ? 'tcp' : 'http';
    const template = `bigip-fast-templates/${templateName}`;

    const parameters = {
        tenant_name: `tenant-${id % MAX_TENANTS}`,
        app_name: `app-${id}`,
        virtual_address: `10.0.${Math.floor(id / 256)}.${id % 256}`,
        server_addresses: [
            `10.0.${Math.floor(id / 256)}.${id % 256}`
        ]
    };

    return {
        name: template,
        parameters
    };
}

function deleteApplications() {
    console.log('Deleting all applications...');
    return Promise.resolve()
        .then(() => doDelete('/mgmt/shared/fast/applications'))
        .then((response) => {
            const taskid = response.body.id;
            return Promise.resolve()
                .then(() => waitForCompletedTask(taskid))
                .catch((e) => {
                    console.log(response.body);
                    return Promise.reject(e);
                });
        })
        .then(() => {
            console.log('Applications deleted');
        });
}

function deployApplications() {
    const appdefs = Array.from(Array(NUM_APPS).keys()).map(x => createApplication(x));
    console.log(`Deploying ${NUM_APPS} applications across ${MAX_TENANTS} tenants`);
    return Promise.resolve()
        .then(() => doPost('/mgmt/shared/fast/applications', appdefs))
        .then((response) => {
            const taskid = response.body.message[0].id;
            return Promise.resolve()
                .then(() => waitForCompletedTask(taskid))
                .catch((e) => {
                    console.log(response.body);
                    return Promise.reject(e);
                });
        })
        .then(() => {
            console.log('Applications deployed');
        });
}

Promise.resolve()
    .then(() => deleteApplications())
    .then(() => deployApplications())
    .catch((e) => {
        console.error(e.stack);
    });
