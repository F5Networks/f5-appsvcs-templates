/* eslint-disable no-console */
/* eslint-disable func-names */

'use strict';

const https = require('https');
const assert = require('assert');

const bigipTarget = process.env.BIGIP_TARGET;
const bigipCreds = process.env.BIGIP_CREDS;

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
    return Promise.resolve()
        .then(() => doGet(`/mgmt/shared/fast/tasks/${taskid}`))
        .then((response) => {
            if (response.body.code === 0) {
                return promiseDelay(1000)
                    .then(() => waitForCompletedTask(taskid));
            }
            return response.body;
        });
}

function deployApplication(templateName, parameters) {
    parameters = parameters || {};
    return Promise.resolve()
        .then(() => doPost('/mgmt/shared/fast/applications', {
            name: templateName,
            parameters
        }))
        .then((response) => {
            const taskid = response.body.message[0].id;
            if (!taskid) {
                console.log(response.body);
                assert(false, 'failed to get a taskid');
            }
            return waitForCompletedTask(taskid);
        })
        .then((task) => {
            if (task.code !== 200) {
                console.log(task);
            }
            assert.strictEqual(task.code, 200);
            assert.strictEqual(task.message, 'success');
        });
}

describe('Applications', function () {
    this.timeout(120000);
    it('Delete all applications', () => Promise.resolve()
        .then(() => doDelete('/mgmt/shared/fast/applications'))
        .then((response) => {
            const taskid = response.body.id;
            if (!taskid) {
                console.log(response.body);
                assert(false, 'failed to get a taskid');
            }
            return waitForCompletedTask(taskid);
        })
        .then((task) => {
            if (task.code !== 200) {
                console.log(task);
            }
            assert.strictEqual(task.code, 200);
        }));

    it('Deploy examples/simple_udp_defaults', () => deployApplication('examples/simple_udp_defaults'));

    it('Deploy bigip-fast-templates/http', () => deployApplication('bigip-fast-templates/http', {
        tenant_name: 'tenant',
        app_name: 'HTTP_App',
        virtual_address: '10.0.0.1',
        pool_members: [
            '10.0.0.1'
        ]
    }));
    it('Deploy bigip-fast-templates/tcp', () => deployApplication('bigip-fast-templates/tcp', {
        tenant_name: 'tenant',
        app_name: 'TCP-App',
        virtual_address: '10.0.0.2',
        pool_members: [
            '10.0.0.2'
        ]
    }));
});
