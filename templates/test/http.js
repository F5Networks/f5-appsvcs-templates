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
    virtual_port: 4430, // TODO: test default values of 80 and 443
    hostnames: ['www.example.com'],

    // http redirect
    redirect80: true,

    // pool spec
    do_pool: true,
    do_pool_priority_groups: false,
    pool_name: undefined,
    pool_members: ['"10.2.1.1"', '"10.2.1.2"'],
    pool_port: 443,
    pool_lb_method: 'round-robin',
    pool_slow_ramp: 10,

    // snat
    do_snat: true,
    snat_pool_name: undefined,
    snat_pool_members: ['"10.3.1.1"', '"10.3.1.2"'],

    // monitor spec
    do_monitor: true,
    monitor_name: undefined,
    monitor_frequency: 30,
    monitor_http_method: 'GET',
    monitor_http_version: '1.1',
    monitor_send_string: '/',
    monitor_expected_response: 'OK',
    monitor_credentials: false,
    monitor_username: undefined,
    monitor_passphrase: undefined,

    // tcp profile spec
    clientside_topology: 'wan',
    clientside_tcp_profile_name: undefined,
    serverside_topology: 'lan',
    serverside_tcp_profile_name: undefined,

    // tls encryption profile spec
    do_tls_server: true,
    tls_server_profile_name: undefined,
    tls_server_certificate: '/Common/default.crt',
    tls_server_key: '/Common/default.key',
    do_tls_client: true,
    tls_client_profile_name: undefined,
    do_tls_chain_certificate: false,
    tls_chain_certificate: undefined,

    // http, xff, caching, compression, and oneconnect
    x_forwarded_for: true,
    http_profile_name: undefined,
    do_caching: false,
    caching_profile_name: undefined,
    do_compression: false,
    compression_profile_name: undefined,
    do_multiplex: false,
    multiplex_profile_name: undefined,

    // irules
    irules: [],

    // traffic policies
    endpoint_policies: [],

    // security policy
    do_security: false,
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
                profileHTTP: 'basic',
                serverTLS: 'app1_tls_server',
                clientTLS: 'app1_tls_client'
            },
            app1_pool: {
                class: 'Pool',
                members: [{
                    servicePort: view.pool_port,
                    serverAddresses: ['10.2.1.1', '10.2.1.2']
                }],
                loadBalancingMode: view.pool_lb_method,
                monitors: ['http']
            },
            app1_snatpool: {
                class: 'SNAT_Pool',
                snatAddresses: ['10.3.1.1', '10.3.1.2']
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
                class: 'TLS_Client',
                sendSNI: view.hostnames[0]
            }
        }
    }
};

describe(template, function () {
    describe('tls bridging with new pool, snatpool, and profiles', function () {
        util.assertRendering(template, view, expected);
    });

    describe('tls bridging with existing pool, snatpool, and profiles', function () {
        before(() => {
            // existing pool
            delete view.pool_members;
            view.pool_name = '/Common/pool1';
            delete expected.t1.app1.app1_pool;
            expected.t1.app1.serviceMain.pool = { bigip: '/Common/pool1' };

            // existing snatpool
            delete view.snat_pool_members;
            view.snat_pool_name = '/Common/snatpool1';
            delete expected.t1.app1.app1_snatpool;
            expected.t1.app1.serviceMain.snat = { bigip: '/Common/snatpool1' };

            // existing TLS profiles
            view.tls_server_name = '/Common/clientssl';
            delete expected.t1.app1.app1_tls_server;
            delete expected.t1.app1.app1_certificate;
            expected.t1.app1.serviceMain.serverTLS = { bigip: '/Common/clientssl' };
            view.tls_client_name = '/Common/serverssl';
            delete expected.t1.app1.app1_tls_client;
            expected.t1.app1.serviceMain.clientTLS = { bigip: '/Common/serverssl' };

            // existing caching, compression, and multiplex profiles
            view.http_profile_name = '/Common/http1';
            expected.t1.app1.serviceMain.profileHTTP = { bigip: '/Common/http1' };
            view.do_caching = true;
            view.caching_profile_name = '/Common/caching1';
            expected.t1.app1.serviceMain.profileHTTPAcceleration = { bigip: '/Common/caching1' };
            view.do_compression = true;
            view.compression_profile_name = '/Common/compression1';
            expected.t1.app1.serviceMain.profileHTTPCompression = { bigip: '/Common/compression1' };
            view.do_multiplex = true;
            view.multiplex_profile_name = '/Common/oneconnect1';
            expected.t1.app1.serviceMain.profileMultiplex = { bigip: '/Common/oneconnect1' };
        });
        util.assertRendering(template, view, expected);
    });

    describe('tls bridging with snat automap and default profiles', function () {
        before(() => {
            // default https virtual port
            view.virtual_port = 443;
            expected.t1.app1.serviceMain.virtualPort = 443;

            // snat automap
            delete view.snat_pool_name;
            expected.t1.app1.serviceMain.snat = 'auto';

            // default caching, compression, and multiplex profiles
            delete view.http_profile_name;
            expected.t1.app1.serviceMain.profileHTTP = 'basic';
            delete view.caching_profile_name;
            expected.t1.app1.serviceMain.profileHTTPAcceleration = 'basic';
            delete view.compression_profile_name;
            expected.t1.app1.serviceMain.profileHTTPCompression = 'basic';
            delete view.multiplex_profile_name;
            expected.t1.app1.serviceMain.profileMultiplex = 'basic';
        });
        util.assertRendering(template, view, expected);
    });

    describe('tls offload with defaults', function () {
        before(() => {
            // no tls client
            view.do_tls_client = false;
            delete expected.t1.app1.serviceMain.clientTLS;
        });
        util.assertRendering(template, view, expected);
    });

    describe('unencrypted http with defaults', function () {
        before(() => {
            // no tls server
            view.do_tls_server = false;
            delete expected.t1.app1.serviceMain.serverTLS;

            // no https
            delete expected.t1.app1.serviceMain.redirect80;
            expected.t1.app1.template = 'http';
            expected.t1.app1.serviceMain.class = 'Service_HTTP';

            // default http virtual port
            view.virtual_port = 80;
            expected.t1.app1.serviceMain.virtualPort = 80;
        });
        util.assertRendering(template, view, expected);
    });

    describe('http with no profiles and no pool', function () {
        before(() => {
            // no profiles
            view.do_caching = false;
            delete expected.t1.app1.serviceMain.profileHTTPAcceleration;
            view.do_compression = false;
            delete expected.t1.app1.serviceMain.profileHTTPCompression;
            view.do_multiplex = false;
            delete expected.t1.app1.serviceMain.profileMultiplex;

            // no pool
            view.do_pool = false;
            delete expected.t1.app1.serviceMain.pool;

            // default http virtual port
            view.virtual_port = 80;
            expected.t1.app1.serviceMain.virtualPort = 80;
        });
        util.assertRendering(template, view, expected);
    });

    describe('clean up', function () {
        util.cleanUp();
    });
});
