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

/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const util = require('./util');

const template = 'templates/bigip-fast-templates/microsoft_adfs.yaml';

const view = {
    tenant_name: 't1',
    app_name: 'app1',

    // virtual server
    virtual_address: '10.1.1.1',
    virtual_port: 443,

    // pool spec
    pool_members: ['10.0.0.1', '10.0.0.2'],
    pool_port: 80,
    load_balancing_mode: 'round-robin',
    slow_ramp_time: 300,

    // monitor spec
    app_fqdn: 'example.f5net.com',
    monitor_interval: 10,

    // snat
    enable_snat: true,
    snat_automap: true,

    // tls encryption profile spec
    enable_tls_server: true,
    tls_cert_name: '/Common/default.crt',
    tls_key_name: '/Common/default.key',
    enable_tls_client: true,
    make_tls_client_profile: true
};

const expected = {
    class: 'ADC',
    schemaVersion: '3.0.0',
    id: 'urn:uuid:a858e55e-bbe6-42ce-a9b9-0f4ab33e3bf7',
    t1: {
        class: 'Tenant',
        app1: {
            class: 'Application',
            template: 'generic',
            app1_pool: {
                class: 'Pool',
                members: [
                    {
                        serverAddresses: [
                            '10.0.0.1',
                            '10.0.0.2'
                        ],
                        servicePort: 80,
                        shareNodes: true
                    }
                ],
                loadBalancingMode: view.load_balancing_mode,
                slowRampTime: view.slow_ramp_time,
                monitors: [{
                    use: 'app1_monitor'
                },
                {
                    use: 'app1_eav_monitor'
                }]
            },
            app1_monitor: {
                class: 'Monitor',
                monitorType: 'https',
                interval: 10,
                timeout: 31,
                send: 'GET /adfs/fs/federationserverservice.asmx HTTP/1.1\r\nHost: example.f5net.com\r\nConnection: Close\r\n\r\n',
                receive: '200 OK'
            },
            app1_eav_monitor: {
                class: 'Monitor',
                monitorType: 'external',
                interval: 10,
                timeout: 31,
                script: {
                    base64: 'IyEvYmluL3NoCiMgVGhlc2UgYXJndW1lbnRzIHN1cHBsaWVkIGF1dG9tYXRpY2FsbHkgZm9yIGFsbCBleHRlcm5hbCBtb25pdG9yczoKIyAkMSA9IElQIChubm4ubm5uLm5ubi5ubm4gbm90YXRpb24pCiMgJDIgPSBwb3J0IChkZWNpbWFsLCBob3N0IGJ5dGUgb3JkZXIpCiMKIyBUaGlzIHNjcmlwdCBleHBlY3RzIHRoZSBmb2xsb3dpbmcgTmFtZS9WYWx1ZSBwYWlyczoKIyBIT1NUID0gdGhlIGhvc3QgbmFtZSBvZiB0aGUgU05JLWVuYWJsZWQgc2l0ZQojIFVSSSAgPSB0aGUgVVJJIHRvIHJlcXVlc3QKIyBSRUNWID0gdGhlIGV4cGVjdGVkIHJlc3BvbnNlCiMKIyBSZW1vdmUgSVB2Ni9JUHY0IGNvbXBhdGliaWxpdHkgcHJlZml4IChMVE0gcGFzc2VzIGFkZHJlc3NlcyBpbiBJUHY2IGZvcm1hdCkKTk9ERT1gZWNobyAkezF9IHwgc2VkICdzLzo6ZmZmZjovLydgCmlmIFtbICROT0RFID1+IF5bMC05XXsxLDN9LlswLTldezEsM30uWzAtOV17MSwzfS5bMC05XXsxLDN9JCBdXTsgdGhlbgpOT0RFPSR7Tk9ERX0KZWxzZQpOT0RFPVske05PREV9XQpmaQpQT1JUPSR7Mn0KUElERklMRT0iL3Zhci9ydW4vYGJhc2VuYW1lICR7MH1gLnNuaV9tb25pdG9yXyR7SE9TVH1fJHtQT1JUfV8ke05PREV9LnBpZCIKaWYgWyAtZiAkUElERklMRSBdCnRoZW4KZWNobyAiRUFWIGV4Y2VlZGVkIHJ1bnRpbWUgbmVlZGVkIHRvIGtpbGwgJHtIT1NUfToke1BPUlR9OiR7Tk9ERX0iIHwgbG9nZ2VyIC1wIGxvY2FsMC5lcnJvcgpraWxsIC05IGBjYXQgJFBJREZJTEVgID4gL2Rldi9udWxsIDI+JjEKZmkKZWNobyAiJCQiID4gJFBJREZJTEUKY3VybC1hcGQgLWsgLWkgLS1yZXNvbHZlICRIT1NUOiRQT1JUOiROT0RFIGh0dHBzOi8vJEhPU1QkVVJJIHwgZ3JlcCAtaSAiJHtSRUNWfSIgPiAvZGV2L251bGwgMj4mMQpTVEFUVVM9JD8Kcm0gLWYgJFBJREZJTEUKaWYgWyAkU1RBVFVTIC1lcSAwIF0KdGhlbgplY2hvICJVUCIKZmkKZXhpdAo='
                },
                environmentVariables: {
                    HOST: 'example.f5net.com',
                    URI: '/adfs/fs/federationserverservice.asmx',
                    RECV: '"200 OK"'
                }
            },
            app1_tls_server: {
                class: 'TLS_Server',
                certificates: [
                    {
                        certificate: 'app1_certificate'
                    }
                ]
            },
            app1_certificate: {
                class: 'Certificate',
                certificate: {
                    bigip: '/Common/default.crt'
                },
                privateKey: {
                    bigip: '/Common/default.key'
                }
            },
            app1_tls_client: {
                class: 'TLS_Client'
            },
            app1_http: {
                class: 'HTTP_Profile',
                xForwardedFor: true
            },
            app1: {
                class: 'Service_HTTPS',
                virtualAddresses: [
                    '10.1.1.1'
                ],
                virtualPort: 443,
                redirect80: false,
                pool: 'app1_pool',
                serverTLS: 'app1_tls_server',
                clientTLS: 'app1_tls_client',
                profileHTTP: {
                    use: 'app1_http'
                },
                snat: 'auto',
                profileTCP: 'normal'
            }
        }
    }
};

describe(template, function () {
    describe('tls bridging with a common virtual address', function () {
        util.assertRendering(template, view, expected);
    });

    describe('clean up', function () {
        util.cleanUp();
    });
});
