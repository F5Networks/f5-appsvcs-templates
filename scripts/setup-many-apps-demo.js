#!/usr/bin/env node
/* eslint-disable no-console */

'use strict';

const https = require('https');

const axios = require('axios');

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

const endpoint = axios.create({
    baseURL: `https://${bigipTarget}`,
    auth: {
        username: bigipCreds.split(':')[0],
        password: bigipCreds.split(':')[1]
    },
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    })
});

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
        .then(() => endpoint.get(`/mgmt/shared/fast/tasks/${taskid}`))
        .then((response) => {
            if (response.data.code === 0) {
                return promiseDelay(1000)
                    .then(() => waitForCompletedTask(taskid));
            }
            return response.data;
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

function handleResponseError(e) {
    if (e.response) {
        const errData = JSON.stringify({
            status: e.response.status,
            body: e.response.data
        }, null, 2);
        console.error(errData);
    }
    return Promise.reject(e);
}

function deleteApplications() {
    console.log('Deleting all applications...');
    return Promise.resolve()
        .then(() => endpoint.delete('/mgmt/shared/fast/applications'))
        .then((response) => {
            const taskid = response.data.id;
            return Promise.resolve()
                .then(() => waitForCompletedTask(taskid))
                .catch((e) => {
                    console.log(response.data);
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
        .then(() => endpoint.post('/mgmt/shared/fast/applications', appdefs))
        .then((response) => {
            const taskid = response.data.message[0].id;
            return Promise.resolve()
                .then(() => waitForCompletedTask(taskid))
                .catch((e) => {
                    console.log(response.data);
                    return Promise.reject(e);
                });
        })
        .then(() => {
            console.log('Applications deployed');
        })
        .catch(e => handleResponseError(e));
}

Promise.resolve()
    .then(() => deleteApplications())
    .then(() => deployApplications())
    .catch((e) => {
        console.error(e.stack);
    });
