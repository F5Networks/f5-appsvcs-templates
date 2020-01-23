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
    use_irules: true,

    // misc optional fields
    virtual_port: 4430,
    hostname: 'www.example.com',

    // pool spec
    use_pool: true,
    pool: 'demo_pool',

    // monitor spec
    use_monitor: true,
    monitor: 'demo_monitor',
    send_string: '/',
    expected_response: 'OK',

    // tcp profile spec
    clientside_network: 'wan',
    serverside_network: 'lan',

    // tls profile spec
    use_tls_server: true,
    tls_server_profile: 'demo_tls_client',
    tls_certificate: 'demo_cert',
    use_tls_client: true,
    tls_client_profile: 'demo_tls_client',

    // compression profile spec
    use_compression: true,
    compression: '/Common/demo_compression'
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
                pool: 'pool1',
                profileHTTPCompression: '/Common/demo_compression',
                profileTCP: {
                    bigip: '/Common/mptcp-mobile-optimized'
                },
                iRules: ['iRule1']
            },
            pool1: {
                class: 'Pool',
                monitors: [
                    'http'
                ],
                members: [{
                    servicePort: 80,
                    serverAddresses: ['10.1.1.1', '10.1.1.2']
                }]
            },
            iRule1: {
                class: 'iRule',
                remark: 'choose private pool based on IP',
                iRule: 'when CLIENT_ACCEPTED {\nif {[IP::client_addr] starts_with "10."} {\n pool `*pvt_pool`\n }\n}'
            }
        }
    }
};

describe('http-basic template', function () {
    util.assertRendering(template, view, expected);
});

describe('http-basic with irules', function () {
    before(() => {
        // remove irule
        view.use_irules = false;
        delete expected.t1.app1.serviceMain.iRules;
        delete expected.t1.app1.iRule1;
    });
    util.assertRendering(template, view, expected);
});

describe('clean up', function () {
    util.cleanUp();
});
