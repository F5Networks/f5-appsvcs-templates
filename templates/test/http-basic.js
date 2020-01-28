/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const util = require('./util');

const template = 'http-basic.yml';

const view = {
    tenant: 't1',
    app: 'app1',

    // virtual server
    virtual_addr: '10.1.1.1',
    virtual_port: 4430,
    hostnames: ['www.example.com'],

    // http redirect
    redirect80: true,

    // pool spec
    do_pool: true,
    do_pool_priority_groups: false,
    pool_name: undefined,
    pool_members: ['10.2.1.1', '10.2.1.2'],
    pool_port: 80,
    pool_lb_method: 'round-robin',
    pool_slow_ramp: 10,

    // snat
    do_snat: true,
    snat_pool_name: undefined,
    snat_pool_members: ['10.3.1.1', '10.3.1.2'],

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
    tls_server_certificate: 'default.crt',
    tls_server_key: 'default.key',
    do_tls_client: true,
    tls_client_profile_name: undefined,
    do_tls_chain_certificate: false,
    tls_chain_certificate: undefined,

    // http, xff, caching, compression, and oneconnect
    http_profile_name: undefined,
    x_forwarded_for: true,
    do_caching: true,
    caching_profile_name: undefined,
    do_compression: true,
    compression_profile_name: undefined,
    do_oneconnect: true,
    oneconnect_profile_name: undefined,

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
                virtualAddresses: ['10.1.1.1'],
                virtualPort: 4430,
                pool: {
                    use: 'app1_pool'
                },
                profileHTTPCaching: 'basic',
                profileHTTPCompression: 'basic'
            },
            app1_pool: {
                class: 'Pool',
                members: [{
                    servicePort: 80,
                    serverAddresses: ['10.2.1.1', '10.2.1.2']
                }],
                loadBalancingMethod: 'round-robin',
                monitors: ['http']
            },
            app1_snatpool: {
                class: 'SNAT',
                members: ['10.3.1.1', '10.3.1.2']
            }
        }
    }
};

describe('http-basic template', function () {
    describe('new pool and profiles', function () {
        util.assertRendering(template, view, expected);
    });

    describe('existing pool and profiles', function () {
        before(() => {
            // remove view properties
            delete view.pool_members;
            delete view.snat_pool_members;
            view.pool_name = '/Common/pool1';
            view.snat_pool_name = '/Common/snatpool1';
            view.caching_profile_name = '/Common/caching1';
            view.compression_profile_name = '/Common/compression1';

            // remove corresponding declaration properties
            delete expected.t1.app1.app1_pool;
            delete expected.t1.app1.app1_snatpool;
            expected.t1.app1.serviceMain.pool = { bigip: '/Common/pool1' };
            expected.t1.app1.serviceMain.profileHTTPCaching = { bigip: '/Common/caching1' };
            expected.t1.app1.serviceMain.profileHTTPCompression = { bigip: '/Common/compression1' };
        });
        util.assertRendering(template, view, expected);
    });

    describe('clean up', function () {
        util.cleanUp();
    });
});
