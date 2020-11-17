/* eslint-disable no-console */
/* eslint-disable func-names */

'use strict';

const https = require('https');

const axios = require('axios');
const assert = require('assert');

const bigipTarget = process.env.BIGIP_TARGET;
const bigipCreds = process.env.BIGIP_CREDS;

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

function deployApplication(templateName, parameters) {
    parameters = parameters || {};
    return Promise.resolve()
        .then(() => endpoint.post('/mgmt/shared/fast/applications', {
            name: templateName,
            parameters
        }))
        .then((response) => {
            const taskid = response.data.message[0].id;
            if (!taskid) {
                console.log(response.data);
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
        })
        .catch((e) => {
            if (e.response) {
                console.error(e.response.data);
            }
            return Promise.reject(e);
        });
}

describe('Applications', function () {
    this.timeout(120000);
    it('Delete all applications', () => Promise.resolve()
        .then(() => endpoint.delete('/mgmt/shared/fast/applications'))
        .then((response) => {
            const taskid = response.data.id;
            if (!taskid) {
                console.log(response.data);
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
            { serverAddresses: ['10.0.0.1'], servicePort: 80 }
        ]
    }));
    it('Deploy bigip-fast-templates/tcp', () => deployApplication('bigip-fast-templates/tcp', {
        tenant_name: 'tenant',
        app_name: 'TCP-App',
        virtual_address: '10.0.0.2',
        pool_members: [
            { serverAddresses: ['10.0.0.2'], servicePort: 80 }
        ]
    }));
    it('Deploy bigip-fast-templates/dns', () => deployApplication('bigip-fast-templates/dns', {
        tenant_name: 'ten',
        app_name: 'DNS-App',
        virtual_address: '10.0.0.3',
        pool_members: [
            { serverAddresses: ['10.0.0.3'], servicePort: 80 }
        ],
        monitor_queryName: 'example.com'
    }));
    it('Deploy bigip-fast-templates/microsoft_exchange', () => deployApplication('bigip-fast-templates/microsoft_exchange', {
        tenant_name: 't-5',
        virtual_address: '10.0.0.4',
        pool_members: [
            '10.0.0.4'
        ],
        app_fqdn: 'example.com'
    }));
    it('Deploy bigip-fast-templates/microsoft_sharepoint', () => deployApplication('bigip-fast-templates/microsoft_sharepoint', {
        tenant_name: 't-5',
        virtual_address: '10.0.0.5',
        pool_members: [
            '10.0.0.5'
        ],
        app_fqdn: 'example.com'
    }));
    it('Deploy bigip-fast-templates/ldap', () => deployApplication('bigip-fast-templates/ldap', {
        tenant_name: 'tenant',
        app_name: 'LDAP-App',
        virtual_address: '10.0.0.6',
        pool_members: [
            { serverAddresses: ['10.0.0.6'], servicePort: 80 }
        ],
        monitor_passphrase: 'aa'
    }));
    it('Deploy bigip-fast-templates/microsoft_iis', () => deployApplication('bigip-fast-templates/microsoft_iis', {
        tenant_name: 'tenant',
        app_name: 'IIS_App',
        virtual_address: '10.0.0.7',
        pool_members: [
            { serverAddresses: ['10.0.0.7'], servicePort: 80 }
        ]
    }));
    it('Deploy bigip-fast-templates/smtp', () => deployApplication('bigip-fast-templates/smtp', {
        tenant_name: 'tenant',
        app_name: 'SMTP-App',
        virtual_address: '10.0.0.8',
        pool_members: [
            { serverAddresses: ['10.0.0.8'], servicePort: 80 }
        ],
        monitor_domain: 'example.com'
    }));
});
