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

const path = require('path');
const fs = require('fs');
const fast = require('@f5devcentral/f5-fast-core');

const perfTracing = {
    enabled: String(process.env.F5_PERF_TRACING_ENABLED).toLowerCase() === 'true',
    endpoint: process.env.F5_PERF_TRACING_ENDPOINT,
    debug: String(process.env.F5_PERF_TRACING_DEBUG).toLowerCase() === 'true'
};

if (perfTracing.enabled && !perfTracing.endpoint) {
    throw new Error('F5_PERF_TRACING_ENDPOINT env var needs to be defined');
}

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
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    })
});

function promiseDelay(timems) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), timems);
    });
}

function handleHTTPError(err, description) {
    if (err.response) {
        const cfg = err.response.config;
        console.log(`${cfg.method} to ${cfg.url}:`);
        console.log(err.response.data);
    }
    const newErr = new Error(
        `Failed to ${description}: ${err.message}`
    );
    newErr.response = err.response;

    return Promise.reject(newErr);
}

function waitForCompletedTask(taskid, useAs3) {
    const url = `/mgmt/shared/${useAs3 ? 'appsvcs/task' : 'fast/tasks'}/${taskid}`;
    return Promise.resolve()
        .then(() => endpoint.get(url))
        .then((response) => {
            const data = response.data;
            const msg = useAs3 ? data.results[0].message : data.message;
            if (msg === 'in progress' || msg === 'pending') {
                return promiseDelay(1000)
                    .then(() => waitForCompletedTask(taskid, useAs3));
            }
            return response.data;
        })
        .catch(e => handleHTTPError(e, 'get task status'));
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
            if (response.data.useBearerToken) {
                endpoint.defaults.headers.common.authorization = `Bearer ${token}`;
            } else {
                endpoint.defaults.headers.common['X-F5-Auth-Token'] = token;
            }
        })
        .catch(e => handleHTTPError(e, 'generate auth token'));
}

// set retryDeleteCtr to 0 before each call to deleteAll Application
let retryDeleteCtr = 0;
function deleteAllApplications() {
    return Promise.resolve()
        .then(() => endpoint.delete('/mgmt/shared/fast/applications'))
        .then((response) => {
            const taskid = response.data.message[0].id;
            if (!taskid) {
                console.log(response.data);
                assert(false, 'failed to get a taskid');
            }
            return waitForCompletedTask(taskid);
        })
        .then((task) => {
            // TODO: temporarily allow '' for Deletes
            const okCode = task.code === '' ? '' : 200;
            if (task.code !== okCode) {
                console.log(task);
            }
            if (retryDeleteCtr <= 11 && task.code === 503 && task.message.match(/Configuration operation in progress on device/)) {
                retryDeleteCtr += 1;
                console.log(`Retry Delete All Applications # ${retryDeleteCtr}`);
                return promiseDelay(10000)
                    .then(() => deleteAllApplications());
            }
            assert.ok(task.code === okCode || task.code === 0);
            return promiseDelay(10000);
        })
        .catch(e => handleHTTPError(e, 'delete applications'));
}

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

    before('Setup', () => Promise.resolve()
        .then(() => getAuthToken())
        .then(() => deleteAllApplications()));

    it('GET template sets include "bigip-fast-templates"', () => Promise.resolve()
        .then(() => assertGet({
            data: [{ name: 'bigip-fast-templates', supported: true }],
            status: 200
        })));
    it('C72081266 GET template sets include "examples"', () => Promise.resolve()
        .then(() => assertGet({
            data: [{ name: 'examples', supported: false }],
            status: 200
        })));
    it('C72081267 DELETE template set by ID', () => Promise.resolve()
        .then(() => endpoint.delete(`${url}/examples`))
        .catch(e => handleHTTPError(e, 'delete examples template set'))
        .then((actual) => {
            assert.strictEqual(actual.status, 200);
            assert.ok(typeof actual.data.requestId === 'number');
            delete actual.data.requestId;
            assert.deepStrictEqual(actual.data, { code: 200, message: 'success', _links: { self: '/mgmt/shared/fast/templatesets/examples' } });
            return assertGet({ data: [{ name: 'examples', supported: false }], status: 200 }, 'examples');
        }));
    it('C72081268 POST re-install template set and GET by ID', () => Promise.resolve()
        .then(() => endpoint.post(url, { name: 'examples' }))
        .catch(e => handleHTTPError(e, 'install examples template set'))
        .then((actual) => {
            assert.strictEqual(actual.status, 200);
            assert.ok(typeof actual.data.requestId === 'number');
            delete actual.data.requestId;
            assert.deepStrictEqual(actual.data, { code: 200, message: '', _links: { self: '/mgmt/shared/fast/templatesets' } });
            return assertGet({ data: [{ name: 'examples', supported: false }], status: 200 }, 'examples');
        }));
    it('POST package, upload and install custom template set', () => {
        const testSetName = 'test_integ';
        const zipFileName = `${testSetName}.zip`;
        const zipFilePath = path.join(__dirname, zipFileName);
        let uploadedFileSize = 0;

        return Promise.resolve()
            .then(() => {
                const tmplProvider = new fast.FsTemplateProvider(__dirname);
                return tmplProvider.buildPackage('testTemplateSet', zipFilePath);
            })
            .then(() => {
                uploadedFileSize = fs.statSync(zipFilePath).size;
                return fs.readFileSync(zipFilePath);
            })
            .then(file => endpoint.post(
                `/mgmt/shared/file-transfer/uploads/${zipFileName}`,
                file,
                {
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'Content-Range': `0-${uploadedFileSize - 1}/${uploadedFileSize}`
                    }
                }
            ))
            .catch(e => handleHTTPError(e, `upload ${zipFileName}`))
            .then(() => endpoint.post(url, { name: 'test_integ' }))
            .catch(e => handleHTTPError(e, `install ${testSetName} template set`))
            .then((actual) => {
                assert.strictEqual(actual.status, 200);
                assert.ok(typeof actual.data.requestId === 'number');
                delete actual.data.requestId;
                assert.deepStrictEqual(actual.data, { code: 200, message: '', _links: { self: '/mgmt/shared/fast/templatesets' } });
                return assertGet({ data: [{ name: testSetName, supported: false }], status: 200 }, testSetName);
            })
            .finally(() => fs.unlinkSync(zipFilePath));
    });
    it('POST install template set from GitHub', () => Promise.resolve()
        .then(() => endpoint.post(url, {
            gitHubRepo: 'mstokes-f5/f5-fast-test-templatesets',
            gitSubDir: 'test',
            unprotected: true
        }))
        .catch(e => handleHTTPError(e, 'install test template set from GitHub'))
        .then((actual) => {
            assert.strictEqual(actual.status, 200);
            return assertGet({ data: [{ name: 'test', supported: false, unprotected: true }], status: 200 }, 'test');
        }));
});

describe('Applications', function () {
    this.timeout(120000);

    function assertResponse(actual, expected) {
        return Promise.resolve()
            .then(() => {
                const exp = expected || { code: 200, message: 'success' };
                if (exp.code === 200 && actual.code !== 200) {
                    console.log(actual);
                }
                assert.strictEqual(actual.code, exp.code);
                assert.match(actual.message, new RegExp(`${exp.message}`));
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
                assert.strictEqual(response.status, 202);
                const taskid = response.data.message[0].id;
                if (!taskid) {
                    console.log(response.data);
                    assert(false, 'failed to get a taskid');
                }
                return waitForCompletedTask(taskid);
            })
            .then(task => assertResponse(task))
            .catch(e => handleHTTPError(e, `deploy ${templateName}`));
    }

    function patchApplication(appName, parameters, expected) {
        return Promise.resolve()
            .then(() => endpoint.patch(`/mgmt/shared/fast/applications/${appName}`, {
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
            .then(task => assertResponse(task, expected))
            .catch((e) => {
                if (expected && expected.code !== 200) {
                    return assertResponse(e.response.data, expected);
                }
                return handleHTTPError(e, `patch ${appName}`);
            });
    }

    before('Setup', () => Promise.resolve()
        .then(() => getAuthToken())
        .then(() => deleteAllApplications()));

    it('C72081269 Deploy examples/simple_udp_defaults', () => deployApplication('examples/simple_udp_defaults'));

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
    it('Deploy bigip-fast-templates/udp', () => deployApplication('bigip-fast-templates/udp', {
        tenant_name: 'tenant',
        app_name: 'UDP-App',
        virtual_address: '10.0.0.10',
        pool_members: [
            { serverAddresses: ['10.0.0.10'] }
        ]
    }));
    it('Deploy bigip-fast-templates/bluegreen', () => deployApplication('bigip-fast-templates/bluegreen', {
        tenant_name: 'tenant',
        app_name: 'bluegreen'
    }));
    it('C72081270 PATCH existing application', () => Promise.resolve()
        .then(() => deployApplication('examples/simple_udp_defaults', {
            application_name: 'patch',
            virtual_address: '10.0.0.11',
            server_addresses: [
                '10.0.0.11'
            ]
        }))
        .then(() => patchApplication('foo/patch', {
            virtual_port: 3333
        })));
    it('C72081271 PATCH existing application should not create a new application', () => Promise.resolve()
        .then(() => deployApplication('examples/simple_udp_defaults', {
            application_name: 'patchBad',
            virtual_address: '10.0.0.12',
            server_addresses: [
                '10.0.0.12'
            ]
        }))
        .then(() => patchApplication('foo/patchBad', {
            application_name: 'patchBad2',
            virtual_address: '10.0.0.13'
        }, {
            code: 422,
            message: 'change application name'
        })));
    it('C72081272 Deploy burst of applications', () => Promise.resolve()
        .then(() => Promise.all([...Array(5).keys()].map(num => Promise.resolve()
            .then(() => endpoint.post('/mgmt/shared/fast/applications', {
                name: 'examples/simple_udp_defaults',
                parameters: {
                    tenant_name: 'tenant',
                    application_name: `burst${num}`,
                    virtual_address: `10.0.1.${num}`,
                    server_addresses: [
                        `10.0.1.${num}`
                    ]
                }
            }))
            .catch(e => handleHTTPError(e, `posting burst app ${num}`)))))
        .then(responses => Promise.all(responses.map(
            resp => waitForCompletedTask(resp.data.message[0].id)
        )))
        .then((tasks) => {
            // console.log(JSON.stringify(
            //     tasks.map(task => ({
            //         id: task.id,
            //         code: task.code,
            //         message: task.message,
            //         application: task.application
            //     })),
            //     null,
            //     2
            // ));
            tasks.forEach((task) => {
                assert.strictEqual(task.code, 200);
            });
        }));
});

describe('Settings', function () {
    this.timeout(120000);
    const url = '/mgmt/shared/fast/settings';

    let enableTelemetry = false;
    let logASM = false;
    let logAFM = false;

    function assertResponse(actual, expected) {
        return Promise.resolve()
            .then(() => {
                assert.strictEqual(actual.status, expected.status);
                delete actual.data.requestId;
                assert.deepStrictEqual(actual.data, expected.data);
            })
            .catch((e) => {
                if (e.response) {
                    console.error(e.response.data);
                }
                return Promise.reject(e);
            });
    }

    before('Setup', () => Promise.resolve()
        .then(() => getAuthToken())
        .then(() => endpoint.delete(url))
        .then(actual => assert(actual, {
            data: { code: 200, message: 'success' },
            status: 200
        }))
        .then(() => endpoint.get('/mgmt/shared/telemetry/info')
            .then(() => { enableTelemetry = true; })
            .catch(e => (e.response && e.response.status === 404 ? Promise.resolve() : Promise.reject(e))))
        .then(() => endpoint.get('/mgmt/tm/sys/provision')
            .then(resp => resp.data)
            .then(data => data.items
                .filter(x => x.level !== 'none')
                .map(x => x.name))
            .then((provisionedModules) => {
                logASM = enableTelemetry && provisionedModules.includes('asm');
                logAFM = enableTelemetry && provisionedModules.includes('afm');
            })
            .catch(e => handleHTTPError(e, 'get provision data'))));

    it('C72081273 GET default settings', () => Promise.resolve()
        .then(() => endpoint.delete(url))
        .then(() => endpoint.get(url))
        .then(actual => assertResponse(actual, {
            data: {
                _links: {
                    self: url
                },
                deletedTemplateSets: [],
                ipamProviders: [],
                enableIpam: false,
                disableDeclarationCache: false,
                // driver defaults
                enable_telemetry: enableTelemetry,
                log_asm: logASM,
                log_afm: logAFM,
                perfTracing: {
                    debug: perfTracing.debug,
                    enabled: perfTracing.enabled
                },
                tsIpAddress: '255.255.255.254'
            },
            status: 200
        })));
    it('C72081274 POST then GET settings', () => {
        const postBody = {
            enable_telemetry: false,
            deletedTemplateSets: [],
            enableIpam: false
        };
        const expected = {
            data: { code: 200, message: '', _links: { self: url } },
            status: 200
        };
        return Promise.resolve()
            .then(() => endpoint.post(url, postBody))
            .then(actual => assertResponse(actual, expected))
            .then(() => endpoint.get(url))
            .then((actual) => {
                expected.data = {
                    deletedTemplateSets: [],
                    ipamProviders: [],
                    enableIpam: false,
                    disableDeclarationCache: false,
                    // driver defaults
                    enable_telemetry: enableTelemetry,
                    log_asm: logASM,
                    log_afm: logAFM,
                    perfTracing: {
                        debug: perfTracing.debug,
                        enabled: perfTracing.enabled
                    },
                    tsIpAddress: '255.255.255.254',
                    _links: { self: url }
                };
                return assertResponse(actual, expected);
            });
    });
    it('POST then GET settings with IPAM', () => {
        const postBody = {
            enable_telemetry: true,
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
                network: 'testnetwork',
                authHeaderValue: 'Bearer SecretValue'
            }],
            enableIpam: false,
            log_afm: logAFM,
            log_asm: logASM,
            perfTracing: {
                debug: perfTracing.debug,
                enabled: perfTracing.enabled
            },
            tsIpAddress: '255.255.255.254',
            disableDeclarationCache: false,
            _links: { self: url }
        };
        const expected = {
            data: { code: 200, _links: { self: url }, message: '' },
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
                assert.strictEqual(actualIpam.authHeaderValue.indexOf('$M$'), 0, 'auth header value must be encrypted');
                delete actualIpam.authHeaderValue;
                delete postBody.ipamProviders[0].authHeaderValue;
                expected.data = postBody;
                return assertResponse(actual, expected);
            });
    });
    it('C72081275 PATCH settings', () => {
        const patchBody = {
            disableDeclarationCache: true,
            ipamProviders: [],
            _links: { self: url }
        };
        const expected = {
            data: { code: 200, _links: { self: url }, message: '' },
            status: 200
        };
        return Promise.resolve()
            .then(() => endpoint.delete(url))
            .then(() => endpoint.patch(url, patchBody))
            .then(actual => assertResponse(actual, expected))
            .then(() => {
                expected.data = {
                    enable_telemetry: enableTelemetry,
                    deletedTemplateSets: [],
                    ipamProviders: [],
                    enableIpam: false,
                    log_afm: logAFM,
                    log_asm: logASM,
                    perfTracing: {
                        debug: perfTracing.debug,
                        enabled: perfTracing.enabled
                    },
                    tsIpAddress: '255.255.255.254',
                    disableDeclarationCache: true,
                    _links: { self: url }
                };
                return endpoint.get(url)
                    .then(res => assertResponse(res, expected));
            });
    });

    it('TS objects added to Common tenant', function () {
        if (!enableTelemetry) {
            return Promise.resolve(this.skip());
        }

        return Promise.resolve()
            .then(() => endpoint.get('/mgmt/shared/appsvcs/declare')
                .then(resp => resp.data)
                .catch(e => handleHTTPError(e, 'get AS3 declaration')))
            .then((decl) => {
                assert.ok(decl.Common);
                assert.ok(decl.Common.Shared);
                assert.ok(decl.Common.Shared.fast_telemetry);

                if (logAFM) {
                    assert.ok(decl.Common.Shared.fast_telemetry_afm_security_log_profile);
                }
                if (logASM) {
                    assert.ok(decl.Common.Shared.fast_telemetry_asm_security_log_profile);
                }
            });
    });
});
