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

const template = 'templates/bigip-fast-templates/http.yaml';

const view = {
    tenant_name: 't1',
    app_name: 'app1',

    // virtual server
    virtual_address: '10.1.1.1',
    virtual_port: 4430,

    // http redirect
    enable_redirect: true,

    // pool spec
    enable_pool: true,
    make_pool: true,
    pool_members: [
        {
            serverAddresses: ['10.2.1.1'], servicePort: 4433, connectionLimit: 0, priorityGroup: 0, shareNodes: true
        },
        {
            serverAddresses: ['10.2.1.2'], servicePort: 4444, connectionLimit: 1000, priorityGroup: 0, shareNodes: true
        }
    ],
    load_balancing_mode: 'round-robin',
    slow_ramp_time: 300,

    // monitor spec
    make_monitor: true,
    monitor_interval: 30,
    monitor_send_string: 'GET / HTTP/1.1\\r\\n\\r\\n',
    monitor_receive: '200 OK',

    // snat
    enable_snat: true,
    snat_automap: false,
    make_snatpool: true,
    snat_addresses: ['10.3.1.1', '10.3.1.2'],

    // persistence
    enable_persistence: true,
    persistence_type: 'cookie',
    enable_fallback_persistence: true,
    fallback_persistence_type: 'source-address',

    // tls encryption profile spec
    enable_tls_server: true,
    make_tls_server_profile: true,
    tls_server_certificate: '/Common/default.crt',
    tls_server_key: '/Common/default.key',
    enable_tls_client: true,
    make_tls_client_profile: true,

    // http, xff, caching, compression, and oneconnect
    common_tcp_profile: false,
    make_tcp_profile: true,
    make_tcp_ingress_profile: true,
    make_tcp_egress_profile: true,
    tcp_ingress_topology: 'wan',
    tcp_egress_topology: 'lan',
    make_http_profile: true,
    x_forwarded_for: true,
    enable_acceleration: true,
    make_acceleration_profile: true,
    enable_compression: true,
    make_compression_profile: true,
    enable_multiplex: true,
    make_multiplex_profile: true,

    // endpoint policy
    endpoint_policy_names: [],

    // irules
    irule_names: [],

    // analytics
    enable_analytics: true,
    make_analytics_profile: true,
    use_http_analytics_profile: false,
    use_tcp_analytics_profile: false,

    // firewall
    enable_firewall: true,
    firewall_allow_list: ['10.0.0.0/8', '11.0.0.0/8'],

    // firewall
    enable_dos: false,
    enable_firewall_staging_policy: false,

    // asm
    enable_waf_policy: true,
    enable_asm_logging: true,
    asm_log_profile_names: ['log local']
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
                class: 'Service_HTTPS',
                virtualAddresses: [view.virtual_address],
                virtualPort: view.virtual_port,
                redirect80: true,
                pool: 'app1_pool',
                snat: {
                    use: 'app1_snatpool'
                },
                persistenceMethods: ['cookie'],
                fallbackPersistenceMethod: 'source-address',
                serverTLS: 'app1_tls_server',
                clientTLS: 'app1_tls_client',
                profileTCP: {
                    ingress: view.tcp_ingress_topology,
                    egress: view.tcp_egress_topology
                },
                profileHTTP: {
                    use: 'app1_http'
                },
                profileHTTPAcceleration: 'basic',
                profileHTTPCompression: 'basic',
                profileMultiplex: 'basic',
                profileAnalytics: {
                    use: 'app1_analytics'
                },
                profileAnalyticsTcp: {
                    use: 'app1_tcp_analytics'
                },
                policyFirewallEnforced: {
                    use: 'app1_fw_policy'
                },
                policyWAF: {
                    use: 'app1_waf_policy'
                },
                securityLogProfiles: [
                    {
                        bigip: 'log local'
                    }
                ],
                policyEndpoint: [],
                iRules: []
            },
            app1_pool: {
                class: 'Pool',
                members: [{
                    servicePort: 4433,
                    serverAddresses: ['10.2.1.1'],
                    connectionLimit: 0,
                    priorityGroup: 0,
                    shareNodes: true
                },
                {
                    servicePort: 4444,
                    serverAddresses: ['10.2.1.2'],
                    connectionLimit: 1000,
                    priorityGroup: 0,
                    shareNodes: true
                }],
                loadBalancingMode: view.load_balancing_mode,
                slowRampTime: 300,
                monitors: [{
                    use: 'app1_monitor'
                }]
            },
            app1_monitor: {
                class: 'Monitor',
                monitorType: 'https',
                interval: 30,
                timeout: 91,
                send: 'GET / HTTP/1.1\r\n\r\n',
                receive: '200 OK'
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
            app1_http: {
                class: 'HTTP_Profile',
                xForwardedFor: true
            },
            app1_analytics: {
                class: 'Analytics_Profile',
                collectedStatsExternalLogging: true,
                externalLoggingPublisher: {
                    bigip: '/Common/default-ipsec-log-publisher'
                },
                capturedTrafficInternalLogging: true,
                notificationBySyslog: true,
                publishIruleStatistics: true,
                collectMaxTpsAndThroughput: true,
                collectPageLoadTime: true,
                collectClientSideStatistics: true,
                collectUserSession: true,
                collectUrl: true,
                collectGeo: true,
                collectIp: true,
                collectSubnet: true,
                collectUserAgent: true
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
            },
            app1_fw_allow_list: {
                class: 'Firewall_Address_List',
                addresses: [
                    '10.0.0.0/8',
                    '11.0.0.0/8'
                ]
            },
            default_fw_deny_list: {
                class: 'Firewall_Address_List',
                addresses: ['0.0.0.0/0']
            },
            app1_fw_rules: {
                class: 'Firewall_Rule_List',
                rules: [
                    {
                        protocol: 'tcp',
                        name: 'acceptTcpPackets',
                        loggingEnabled: true,
                        source: {
                            addressLists: [
                                {
                                    use: 'app1_fw_allow_list'
                                }
                            ]
                        },
                        action: 'accept'
                    },
                    {
                        protocol: 'any',
                        name: 'dropPackets',
                        loggingEnabled: true,
                        source: {
                            addressLists: [
                                {
                                    use: 'default_fw_deny_list'
                                }
                            ]
                        },
                        action: 'drop'
                    }
                ]
            },
            app1_fw_policy: {
                class: 'Firewall_Policy',
                rules: [
                    {
                        use: 'app1_fw_rules'
                    }
                ]
            },
            app1_waf_policy: {
                class: 'WAF_Policy',
                policy: {
                    text: '{ "policy": { "template": { "name": "POLICY_TEMPLATE_RAPID_DEPLOYMENT" } } }'
                },
                ignoreChanges: true
            }
        }
    }
};

describe(template, function () {
    describe('tls bridging with new pool, snatpool, and profiles', function () {
        util.assertRendering(template, view, expected);
    });

    describe('tls bridging with existing monitor, snatpool, and profiles', function () {
        before(() => {
            // existing TLS profiles
            view.make_tls_server_profile = false;
            view.tls_server_profile_name = '/Common/clientssl';
            delete expected.t1.app1.app1_tls_server;
            delete expected.t1.app1.app1_certificate;
            expected.t1.app1.app1.serverTLS = { bigip: '/Common/clientssl' };
            view.make_tls_client_profile = false;
            view.tls_client_profile_name = '/Common/serverssl';
            delete expected.t1.app1.app1_tls_client;
            expected.t1.app1.app1.clientTLS = { bigip: '/Common/serverssl' };

            // existing caching, compression, and multiplex profiles
            delete expected.t1.app1.app1_http;
            view.make_http_profile = false;
            view.http_profile_name = '/Common/http1';
            expected.t1.app1.app1.profileHTTP = { bigip: '/Common/http1' };
            view.make_acceleration_profile = false;
            view.acceleration_profile_name = '/Common/caching1';
            expected.t1.app1.app1.profileHTTPAcceleration = { bigip: '/Common/caching1' };
            view.make_compression_profile = false;
            view.compression_profile_name = '/Common/compression1';
            expected.t1.app1.app1.profileHTTPCompression = { bigip: '/Common/compression1' };
            view.make_multiplex_profile = false;
            view.multiplex_profile_name = '/Common/oneconnect1';
            expected.t1.app1.app1.profileMultiplex = { bigip: '/Common/oneconnect1' };

            // existing analytics profiles
            view.make_analytics_profile = false;
            view.use_http_analytics_profile = true;
            view.analytics_existingHttpProfile = '/Common/analytics';
            expected.t1.app1.app1.profileAnalytics = { bigip: '/Common/analytics' };
            delete expected.t1.app1.app1_analytics;
            view.use_tcp_analytics_profile = true;
            view.analytics_existing_tcp_profile = '/Common/tcp-analytics';
            expected.t1.app1.app1.profileAnalyticsTcp = { bigip: '/Common/tcp-analytics' };
            delete expected.t1.app1.app1_tcp_analytics;

            // existing DOS & staging profiles
            view.enable_dos = true;
            view.dos_profile = '/Common/dos1';
            expected.t1.app1.app1.profileDOS = { bigip: '/Common/dos1' };
            view.enable_firewall_staging_policy = true;
            view.firewall_staging_policy = '/Common/staging1';
            expected.t1.app1.app1.policyFirewallStaged = { bigip: '/Common/staging1' };
        });
        util.assertRendering(template, view, expected);
    });

    describe('tls offload with snat automap and default profiles', function () {
        before(() => {
            // default https virtual port
            view.virtual_port = 443;
            expected.t1.app1.app1.virtualPort = 443;

            // remove TLS client
            view.enable_tls_client = false;
            delete expected.t1.app1.app1.clientTLS;
            expected.t1.app1.app1_monitor.monitorType = 'http';

            // snat automap
            view.snat_automap = true;
            delete expected.t1.app1.app1_snatpool;
            expected.t1.app1.app1.snat = 'auto';

            // default caching, compression, and multiplex profiles
            delete view.acceleration_profile_name;
            view.make_acceleration_profile = true;
            expected.t1.app1.app1.profileHTTPAcceleration = 'basic';
            delete view.compression_profile_name;
            view.make_compression_profile = true;
            expected.t1.app1.app1.profileHTTPCompression = 'basic';
            delete view.multiplex_profile_name;
            view.make_multiplex_profile = true;
            expected.t1.app1.app1.profileMultiplex = 'basic';
        });
        util.assertRendering(template, view, expected);
    });

    describe('tls pass-thru with existing pool, specified irule and endpoint policy', function () {
        before(() => {
            // existing pool
            delete view.pool_members;
            view.make_pool = false;
            view.pool_name = '/Common/pool1';
            delete expected.t1.app1.app1_pool;
            expected.t1.app1.app1.pool = { bigip: '/Common/pool1' };
            delete expected.t1.app1.app1_monitor;
            view.irule_names = ['/Common/my_irule'];
            view.endpoint_policy_names = ['/Common/my_policy'];
            expected.t1.app1.app1.iRules = [{
                bigip: '/Common/my_irule'
            }];
            expected.t1.app1.app1.policyEndpoint = [{
                bigip: '/Common/my_policy'
            }];
        });
        util.assertRendering(template, view, expected);
    });

    describe('clean up', function () {
        util.cleanUp();
    });
});
