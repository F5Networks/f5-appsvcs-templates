/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const util = require('./util');

const template = 'templates/bigip-fast-templates/tcp.yaml';

const view = {
    tenant_name: 't1',
    app_name: 'app1',

    // virtual server
    virtual_address: '10.1.1.1',
    virtual_port: 4430,
    hostnames: ['www.example.com'],

    // pool spec
    enable_pool: true,
    make_pool: true,
    pool_members: [
        {
            serverAddresses: ['10.2.1.1'], servicePort: 4433, connectionLimit: 0, priorityGroup: 0, shareNodes: true
        },
        {
            serverAddresses: ['10.2.1.2'], servicePort: 4433, connectionLimit: 0, priorityGroup: 0, shareNodes: true
        }
    ],
    pool_port: 4433,
    load_balancing_mode: 'round-robin',
    slow_ramp_time: 300,

    // snat
    enable_snat: true,
    snat_automap: false,
    snat_addresses: ['10.3.1.1', '10.3.1.2'],

    // persistence
    enable_persistence: true,
    persistence_type: 'source-address',
    enable_fallback_persistence: false
};

const expected = {
    class: 'ADC',
    schemaVersion: '3.0.0',
    id: 'urn:uuid:a858e55e-bbe6-42ce-a9b9-0f4ab33e3bf7',
    t1: {
        class: 'Tenant',
        app1: {
            class: 'Application',
            template: 'tcp',
            serviceMain: {
                class: 'Service_TCP',
                virtualAddresses: [view.virtual_address],
                virtualPort: view.virtual_port,
                pool: 'app1_pool',
                snat: {
                    use: 'app1_snatpool'
                },
                persistenceMethods: ['source-address'],
                profileTCP: {
                    ingress: 'wan',
                    egress: 'lan'
                },
                iRules: []
            },
            app1_pool: {
                class: 'Pool',
                members: [{
                    servicePort: view.pool_port,
                    serverAddresses: ['10.2.1.1'],
                    connectionLimit: 0,
                    priorityGroup: 0,
                    shareNodes: true
                },
                {
                    servicePort: view.pool_port,
                    serverAddresses: ['10.2.1.1'],
                    connectionLimit: 0,
                    priorityGroup: 0,
                    shareNodes: true
                }],
                loadBalancingMode: view.load_balancing_mode,
                slowRampTime: 300,
                monitors: ['tcp']
            },
            app1_snatpool: {
                class: 'SNAT_Pool',
                snatAddresses: view.snat_addresses
            }
        }
    }
};

describe(template, function () {
    describe('new pool, snatpool, and profiles', function () {
        util.assertRendering(template, view, expected);
    });
    return;
    describe('default pool port, existing monitor, snatpool, and profiles', function () {
        before(() => {
            // default https pool port and existing monitor
            delete view.pool_port;
            expected.t1.app1.app1_pool.members[0].servicePort = 80;
            view.make_monitor = false;
            view.monitor_name = '/Common/monitor1';
            expected.t1.app1.app1_pool.monitors = [{ bigip: '/Common/monitor1' }];
        });
        util.assertRendering(template, view, expected);
    });

    describe('existing pool, snat automap and default profiles', function () {
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
        });
        util.assertRendering(template, view, expected);
    });

    describe('clean up', function () {
        util.cleanUp();
    });
});
