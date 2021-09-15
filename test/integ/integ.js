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
/* eslint-disable func-names */

'use strict';

const https = require('https');

const axios = require('axios');
const assert = require('assert');

const bigipTarget = process.env.BIGIP_TARGET;
const bigipCreds = process.env.BIGIP_CREDS;
const perfTracing = {
    enabled: (String(process.env.F5_PERF_TRACING_ENABLED).toLowerCase() === 'true'),
    endpoint: process.env.F5_PERF_TRACING_ENDPOINT,
    debug: String(process.env.F5_PERF_TRACING_DEBUG).toLowerCase() === 'true'
};

if (!bigipTarget) {
    throw new Error('BIGIP_TARGET env var needs to be defined');
}

if (!bigipCreds) {
    throw new Error('BIGIP_CREDS env var needs to be defined');
}

if (perfTracing.enabled && !perfTracing.endpoint) {
    throw new Error('F5_PERF_TRACING_ENDPOINT env var needs to be defined');
}

const endpoint = axios.create({
    baseURL: `https://${bigipTarget}`,
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

function getAuthToken() {
    return Promise.resolve()
        .then(() => endpoint.post('/mgmt/shared/authn/login', {
            username: bigipCreds.split(':')[0],
            password: bigipCreds.split(':')[1],
            loginProviderName: 'tmos'
        }))
        .then((response) => {
            const token = response.data.token.token;
            endpoint.defaults.headers.common['X-F5-Auth-Token'] = token;
        })
        .catch(err => Promise.reject(new Error(`Unable to generate auth token: ${err.message}`)));
}

function deleteAllApplications() {
    return Promise.resolve()
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
        })
        .catch(err => Promise.reject(new Error(`Failed to delete applications: ${err.message}`)));
}


before('Setup', function () {
    this.timeout(20000);
    if (perfTracing.enabled) {
        const url = '/mgmt/shared/fast/settings';

        return getAuthToken()
            .then(() => endpoint.patch(url, { perfTracing }))
            .then(() => endpoint.get(url))
            .then((actual) => {
                console.log(JSON.stringify(actual.data));
                const actualPerfSettings = actual.data.perfTracing;
                assert.deepStrictEqual(actualPerfSettings, perfTracing, 'Unable to set up perf tracing');
            })
            // allow some time for settings to be applied to avoid 503
            .then(() => new Promise((resolve) => { setTimeout(resolve, 10000); }))
            .catch((err) => {
                console.log(err);
            });
    }
    return Promise.resolve();
});

describe('Template Sets', function () {
    this.timeout(120000);
    const url = '/mgmt/shared/fast/templatesets';

    function assertGet(expected, templateSetId) {
        const fullUrl = templateSetId ? `${url}/${templateSetId}` : url;
        return Promise.resolve()
            .then(() => endpoint.get(fullUrl))
            .then((actual) => {
                assert.strictEqual(actual.status, expected.status);
                if (Array.isArray(expected.data)) {
                    expected.data.forEach((expTemplateSet) => {
                        const templateSet = templateSetId ? actual.data
                            : actual.data.find(ts => ts.name === expTemplateSet.name);
                        assert.ok(templateSet, `Template with name ${expTemplateSet.name} must exist`);
                        if (templateSet.enabled) {
                            assert.ok(templateSet.templates.length > 0, 'Template set must contain templates');
                        }
                        assert.ok(templateSet.hash, 'Template set must contain a hash');
                        assert.strictEqual(templateSet.supported, expTemplateSet.supported, 'Template set must show correct supported flag');
                        if (typeof expTemplateSet.enabled !== 'undefined') {
                            assert.strictEqual(
                                templateSet.enabled,
                                expTemplateSet.enabled,
                                'Template set must show currect enabled flag'
                            );
                        }
                    });
                } else {
                    assert.deepStrictEqual(actual.data, expected.data);
                }
            })
            .catch((e) => {
                if (!e.response) {
                    return Promise.reject(e);
                }

                if (!expected.error) {
                    console.error(e.response.data);
                    return Promise.reject(e);
                }
                assert.deepStrictEqual(e.response.data, expected.error);
                assert.strictEqual(e.response.status, expected.status);
                return Promise.resolve();
            });
    }

    before(() => getAuthToken());
    before('Delete all applications', deleteAllApplications);

    it('GET built-in template sets', () => Promise.resolve()
        .then(() => assertGet({
            data: [
                { name: 'bigip-fast-templates', supported: true },
                { name: 'examples', supported: false }
            ],
            status: 200
        })));
    it('DELETE template set by ID', () => Promise.resolve()
        .then(() => endpoint.delete(`${url}/examples`))
        .then((actual) => {
            assert.strictEqual(actual.status, 200);
            assert.deepStrictEqual(actual.data, { code: 200, message: 'success' });
            return assertGet({ data: [{ name: 'examples', supported: false }], status: 200 }, 'examples');
        }));
    it('POST re-install template set and GET by ID', () => Promise.resolve()
        .then(() => endpoint.post(url, { name: 'examples' }))
        .then((actual) => {
            assert.strictEqual(actual.status, 200);
            assert.deepStrictEqual(actual.data, { code: 200, message: '' });
            return assertGet({ data: [{ name: 'examples', supported: false }], status: 200 }, 'examples');
        }));
});

describe('Applications', function () {
    this.timeout(120000);
    before(() => getAuthToken());
    before('Delete all applications', deleteAllApplications);

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

    it('Deploy examples/simple_udp_defaults', () => deployApplication('examples/simple_udp_defaults'));

    it('Deploy bigip-fast-templates/http', () => deployApplication('bigip-fast-templates/http', {
        tenant_name: 'tenant',
        app_name: 'HTTP_App',
        virtual_address: '10.0.0.1',
        pool_members: [
            { serverAddresses: ['10.0.0.1'] }
        ]
    }));
    it('Deploy bigip-fast-templates/tcp', () => deployApplication('bigip-fast-templates/tcp', {
        tenant_name: 'tenant',
        app_name: 'TCP-App',
        virtual_address: '10.0.0.2',
        pool_members: [
            { serverAddresses: ['10.0.0.2'] }
        ]
    }));
    it('Deploy bigip-fast-templates/dns', () => deployApplication('bigip-fast-templates/dns', {
        tenant_name: 'ten',
        app_name: 'DNS-App',
        virtual_address: '10.0.0.3',
        pool_members: [
            { serverAddresses: ['10.0.0.3'] }
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
            { serverAddresses: ['10.0.0.5'] }
        ],
        app_fqdn: 'example.com',
        monitor_fqdn: 'example.com'
    }));
    it('Deploy bigip-fast-templates/ldap', () => deployApplication('bigip-fast-templates/ldap', {
        tenant_name: 'tenant',
        app_name: 'LDAP-App',
        virtual_address: '10.0.0.6',
        pool_members: [
            { serverAddresses: ['10.0.0.6'] }
        ],
        monitor_passphrase: 'aa'
    }));
    it('Deploy bigip-fast-templates/microsoft_iis', () => deployApplication('bigip-fast-templates/microsoft_iis', {
        tenant_name: 'tenant',
        app_name: 'IIS_App',
        virtual_address: '10.0.0.7',
        pool_members: [
            { serverAddresses: ['10.0.0.7'] }
        ]
    }));
    it('Deploy bigip-fast-templates/smtp', () => deployApplication('bigip-fast-templates/smtp', {
        tenant_name: 'tenant',
        app_name: 'SMTP-App',
        virtual_address: '10.0.0.8',
        pool_members: [
            { serverAddresses: ['10.0.0.8'] }
        ],
        monitor_domain: 'example.com'
    }));
    it('Deploy bigip-fast-templates/microsoft_adfs', () => deployApplication('bigip-fast-templates/microsoft_adfs', {
        tenant_name: 't-5',
        virtual_address: '10.0.0.9',
        pool_members: [
            '10.0.0.9'
        ]
    }));
});

describe('Settings', function () {
    this.timeout(120000);
    const url = '/mgmt/shared/fast/settings';

    function assertResponse(actual, expected) {
        return Promise.resolve()
            .then(() => {
                assert.strictEqual(actual.status, expected.status);
                assert.deepStrictEqual(actual.data, expected.data);
            })
            .catch((e) => {
                if (e.response) {
                    console.error(e.response.data);
                }
                return Promise.reject(e);
            });
    }

    before(() => getAuthToken());
    before('DELETE existing settings', () => Promise.resolve()
        .then(() => endpoint.delete(url))
        .then(actual => assert(actual, {
            data: { code: 200, message: 'success' },
            status: 200
        })));
    it('GET default settings', () => Promise.resolve()
        .then(() => endpoint.get(url))
        .then(actual => assertResponse(actual, {
            data: {
                deletedTemplateSets: [],
                ipamProviders: [],
                enableIpam: false,
                disableDeclarationCache: false,
                perfTracing: { debug: false, enabled: false }
            },
            status: 200
        })));
    it('POST then GET settings', () => {
        const postBody = {
            enable_telemetry: false,
            deletedTemplateSets: [],
            ipamProviders: [{
                serviceType: 'Generic',
                name: 'testProvider',
                host: '10.10.10.11',
                username: 'testuser',
                password: 'testpwd',
                retrieveUrl: '/getips',
                retrieveBody: '{ num: 1 }',
                retrievePathQuery: '$testQuery',
                releaseUrl: '/releaseips',
                releaseBody: '{ ip: $testIp }',
                apiVersion: '1.2.3',
                network: 'testnetwork'
            }],
            enableIpam: false,
            log_afm: false,
            log_asm: false,
            disableDeclarationCache: false,
            perfTracing
        };
        const expected = {
            data: { code: 200, message: '' },
            status: 200
        };
        return endpoint.post(url, postBody)
            .then(actual => assertResponse(actual, expected))
            .then(() => endpoint.get(url))
            .then((actual) => {
                const actualIpam = actual.data.ipamProviders[0];
                assert.strictEqual(actualIpam.password.indexOf('$M$'), 0, 'password must be encrypted');
                delete actualIpam.password;
                delete postBody.ipamProviders[0].password;
                expected.data = postBody;
                return assertResponse(actual, expected);
            });
    });
    it('PATCH settings', () => {
        const patchBody = {
            deletedTemplateSets: ['examples'],
            ipamProviders: [],
            perfTracing: {
                enabled: false
            }
        };
        const expected = {
            data: { code: 200, message: '' },
            status: 200
        };
        return endpoint.patch(url, patchBody)
            .then(actual => assertResponse(actual, expected))
            .then(() => {
                expected.data = {
                    enable_telemetry: false,
                    deletedTemplateSets: ['examples'],
                    ipamProviders: [],
                    enableIpam: false,
                    log_afm: false,
                    log_asm: false,
                    disableDeclarationCache: false,
                    perfTracing: {
                        debug: false,
                        enabled: false
                    }
                };
                return endpoint.get(url)
                    .then(res => assertResponse(res, expected));
            });
    });
});
