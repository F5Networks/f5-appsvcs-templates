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

const template = 'templates/bigip-fast-templates/smtp.yaml';

const view = {
    tenant_name: 't1',
    app_name: 'app1',

    // virtual server
    virtual_address: '10.1.1.1',
    virtual_port: 25,

    // pool spec
    enable_pool: true,
    make_pool: true,
    pool_members: [
        {
            serverAddresses: ['10.2.1.1'], servicePort: 8025, connectionLimit: 500, priorityGroup: 1, shareNodes: true
        },
        {
            serverAddresses: ['10.2.1.2'], servicePort: 8025, connectionLimit: 1000, priorityGroup: 1, shareNodes: true
        }
    ],
    load_balancing_mode: 'round-robin',
    slow_ramp_time: 500,

    // monitor spec
    enable_monitor: true,
    make_monitor: true,
    monitor_interval: 33,
    monitor_username: 'user1',
    monitor_passphrase: 'cGFzcw==',
    monitor_domain: 'example.f5net.com',

    // snat
    enable_snat: true,
    snat_automap: false,
    make_snatpool: true,
    snat_addresses: ['10.3.1.1', '10.3.1.2'],

    // tls encryption profile spec
    enable_tls_server: true,
    make_tls_server_profile: true,
    tls_server_certificate: '/Common/default.crt',
    tls_server_key: '/Common/default.key',
    enable_tls_client: true,
    make_tls_client_profile: true,

    // irule
    irule_names: [],

    // analytics
    enable_analytics: true,
    make_analytics_profile: true
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
            app1: {
                class: 'Service_TCP',
                virtualAddresses: [view.virtual_address],
                virtualPort: view.virtual_port,
                pool: 'app1_pool',
                snat: {
                    use: 'app1_snatpool'
                },
                serverTLS: 'app1_tls_server',
                clientTLS: 'app1_tls_client',
                profileTCP: {
                    ingress: 'wan',
                    egress: 'lan'
                },
                iRules: [],
                profileAnalyticsTcp: {
                    use: 'app1_tcp_analytics'
                }
            },
            app1_pool: {
                class: 'Pool',
                members: [{
                    servicePort: 8025,
                    serverAddresses: ['10.2.1.1'],
                    connectionLimit: 500,
                    priorityGroup: 1,
                    shareNodes: true
                },
                {
                    servicePort: 8025,
                    serverAddresses: ['10.2.1.2'],
                    connectionLimit: 1000,
                    priorityGroup: 1,
                    shareNodes: true
                }],
                loadBalancingMode: view.load_balancing_mode,
                slowRampTime: 500,
                monitors: [{
                    use: 'app1_monitor'
                }]
            },
            app1_monitor: {
                class: 'Monitor',
                monitorType: 'smtp',
                interval: 33,
                timeout: 100,
                domain: 'example.f5net.com',
                username: 'user1',
                passphrase: {
                    ciphertext: 'cGFzcw==',
                    protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0'
                }
            },
            app1_snatpool: {
                class: 'SNAT_Pool',
                snatAddresses: view.snat_addresses
            },
            app1_tls_server: {
                class: 'TLS_Server',
                certificates: [{
                    certificate: 'app1_certificate'
                }]
            },
            app1_certificate: {
                class: 'Certificate',
                certificate: { bigip: view.tls_server_certificate },
                privateKey: { bigip: view.tls_server_key }
            },
            app1_tls_client: {
                class: 'TLS_Client'
            },
            app1_tcp_analytics: {
                class: 'Analytics_TCP_Profile',
                collectedStatsExternalLogging: true,
                externalLoggingPublisher: {
                    bigip: '/Common/default-ipsec-log-publisher'
                },
                collectRemoteHostIp: true,
                collectNexthop: true,
                collectCity: true,
                collectPostCode: true
            }
        }
    }
};

describe(template, function () {
    describe('tls bridging with new pool, snatpool, and profiles', function () {
        util.assertRendering(template, view, expected);
    });

    describe('use existing analytics profile', function () {
        before(() => {
            // existing analytics profiles
            view.make_analytics_profile = false;
            view.analytics_existingTcpProfile = '/Common/tcp-analytics';
            expected.t1.app1.app1.profileAnalyticsTcp = { bigip: '/Common/tcp-analytics' };
            delete expected.t1.app1.app1_tcp_analytics;
        });
    });

    describe('clean up', function () {
        util.cleanUp();
    });
});
