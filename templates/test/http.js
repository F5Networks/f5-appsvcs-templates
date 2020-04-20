/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const util = require('./util');

const template = 'bigip-fast-templates/http.yml';

const view = {
    tenant_name: 't1',
    app_name: 'app1',

    // virtual server
    virtual_address: '10.1.1.1',
    virtual_port: 4430,
    hostnames: ['www.example.com'],

    // http redirect
    enable_redirect: true,

    // pool spec
    enable_pool: true,
    make_pool: true,
    pool_members: ['10.2.1.1', '10.2.1.2'],
    pool_port: 4433,
    load_balancing_mode: 'round-robin',
    slow_ramp_time: 300,

    // snat
    enable_snat: true,
    snat_automap: false,
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
    make_tcp_profile: true,
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

    // irules
    irules: [],

    // traffic policies
    endpoint_policies: [],

    // security policy
    enable_security: false,
    security_policy_name: undefined,

    // request logging
    request_logging_profile_name: undefined
};

const expected = {
    class: 'ADC',
    schemaVersion: '3.0.0',
    id: 'urn:uuid:a858e55e-bbe6-42ce-a9b9-0f4ab33e3bf7',
    t1: {
        class: 'Tenant',
        app1: {
            class: 'Application',
            template: 'https',
            serviceMain: {
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
                profileMultiplex: 'basic'
            },
            app1_pool: {
                class: 'Pool',
                members: [{
                    servicePort: view.pool_port,
                    serverAddresses: ['10.2.1.1', '10.2.1.2'],
                    shareNodes: true
                }],
                loadBalancingMode: view.load_balancing_mode,
                slowRampTime: 300,
                monitors: ['https']
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
            }
        }
    }
};

describe(template, function () {
    describe('tls bridging with new pool, snatpool, and profiles', function () {
        util.assertRendering(template, view, expected);
    });

    describe('tls bridging with default pool port, existing monitor, snatpool, and profiles', function () {
        before(() => {
            // default https pool port and existing monitor
            delete view.pool_port;
            expected.t1.app1.app1_pool.members[0].servicePort = 80;
            view.make_monitor = false;
            view.monitor_name = '/Common/monitor1';
            expected.t1.app1.app1_pool.monitors = [{ bigip: '/Common/monitor1' }];

            // existing TLS profiles
            view.make_tls_server_profile = false;
            view.tls_server_profile_name = '/Common/clientssl';
            delete expected.t1.app1.app1_tls_server;
            delete expected.t1.app1.app1_certificate;
            expected.t1.app1.serviceMain.serverTLS = { bigip: '/Common/clientssl' };
            view.make_tls_client_profile = false;
            view.tls_client_profile_name = '/Common/serverssl';
            delete expected.t1.app1.app1_tls_client;
            expected.t1.app1.serviceMain.clientTLS = { bigip: '/Common/serverssl' };

            // existing caching, compression, and multiplex profiles
            delete expected.t1.app1.app1_http;
            view.make_http_profile = false;
            view.http_profile_name = '/Common/http1';
            expected.t1.app1.serviceMain.profileHTTP = { bigip: '/Common/http1' };
            view.make_acceleration_profile = false;
            view.acceleration_profile_name = '/Common/caching1';
            expected.t1.app1.serviceMain.profileHTTPAcceleration = { bigip: '/Common/caching1' };
            view.make_compression_profile = false;
            view.compression_profile_name = '/Common/compression1';
            expected.t1.app1.serviceMain.profileHTTPCompression = { bigip: '/Common/compression1' };
            view.make_multiplex_profile = false;
            view.multiplex_profile_name = '/Common/oneconnect1';
            expected.t1.app1.serviceMain.profileMultiplex = { bigip: '/Common/oneconnect1' };
        });
        util.assertRendering(template, view, expected);
    });

    describe('tls bridging with existing pool, snat automap and default profiles', function () {
        before(() => {
            // default https virtual port
            delete view.virtual_port;
            expected.t1.app1.serviceMain.virtualPort = 443;

            // existing pool
            delete view.pool_members;
            view.make_pool = false;
            view.pool_name = '/Common/pool1';
            delete expected.t1.app1.app1_pool;
            expected.t1.app1.serviceMain.pool = { bigip: '/Common/pool1' };

            // snat automap
            view.snat_automap = true;
            delete expected.t1.app1.app1_snatpool;
            expected.t1.app1.serviceMain.snat = 'auto';

            // default caching, compression, and multiplex profiles
            delete view.acceleration_profile_name;
            view.make_acceleration_profile = true;
            expected.t1.app1.serviceMain.profileHTTPAcceleration = 'basic';
            delete view.compression_profile_name;
            view.make_compression_profile = true;
            expected.t1.app1.serviceMain.profileHTTPCompression = 'basic';
            delete view.multiplex_profile_name;
            view.make_multiplex_profile = true;
            expected.t1.app1.serviceMain.profileMultiplex = 'basic';
        });
        util.assertRendering(template, view, expected);
    });

    describe('clean up', function () {
        util.cleanUp();
    });
});
