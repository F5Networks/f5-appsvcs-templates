/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const util = require('./util');

const template = 'http-basic.yml';

const view = {
    tenant: 't1',
    app: 'app1',
    virtual_addr: '10.1.1.1',

    // misc optional fields
    virtual_port: 4430,
    hostname: 'www.example.com',

    // pool spec
    do_pool: true,
    pool_members: [{
        servicePort: 80,
        serverAddresses: ['10.1.1.1', '10.1.1.2']
    }],

    // monitor spec
    do_monitor: true,
    monitor: 'demo_monitor',
    send_string: '/',
    expected_response: 'OK',

    // tcp profile spec
    clientside_network: 'wan',
    serverside_network: 'lan',

    // tls profile spec
    do_tls_server: true,
    tls_server_profile: 'demo_tls_client',
    tls_certificate: 'demo_cert',
    do_tls_client: true,
    tls_client_profile: 'demo_tls_client',

    // compression profile spec
    do_compression: true
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
                profileHTTPCompression: 'basic'
            },
            app1_pool: {
                class: 'Pool',
                monitors: [
                    'http'
                ],
                members: [{
                    servicePort: 80,
                    serverAddresses: ['10.1.1.1', '10.1.1.2']
                }]
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
            view.pool_name = '/Common/pool1';
            view.compression_profile_name = '/Common/compression1';

            // remove corresponding declaration properties
            delete expected.t1.app1.app1_pool;
            expected.t1.app1.serviceMain.pool = { bigip: '/Common/pool1' };
            expected.t1.app1.serviceMain.profileHTTPCompression = { bigip: '/Common/compression1' };
        });
        util.assertRendering(template, view, expected);
    });

    describe('clean up', function () {
        util.cleanUp();
    });
});
