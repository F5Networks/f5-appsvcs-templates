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
const { monitorTests, poolTests } = require('./common/tests');

const template = 'templates/bigip-fast-templates/udp.yaml';

const view = {
    tenant_name: 't1',
    app_name: 'app1',

    // virtual server
    virtual_address: '10.1.1.1',
    virtual_port: 4430,

    // pool spec
    enable_pool: true,
    make_pool: true,
    pool_members: [
        {
            addressDiscovery: 'static', serverAddresses: ['10.2.1.1'], servicePort: 4433, connectionLimit: 0, priorityGroup: 0, shareNodes: true
        },
        {
            addressDiscovery: 'static', serverAddresses: ['10.2.1.2'], servicePort: 4444, connectionLimit: 1000, priorityGroup: 0, shareNodes: true
        }
    ],
    load_balancing_mode: 'round-robin',
    slow_ramp_time: 300,

    // monitor spec
    enable_monitor: true,
    make_monitor: true,
    monitor_interval: 30,

    // snat
    enable_snat: true,
    snat_automap: false,
    snat_addresses: ['10.3.1.1', '10.3.1.2'],

    // persistence
    enable_persistence: true,
    persistence_type: 'source-address',
    enable_fallback_persistence: false,

    // irule
    irule_names: ['example_irule'],

    // firewall
    enable_firewall: true,
    firewall_allow_list: ['10.0.0.0/8', '11.0.0.0/8'],

    // asm
    enable_asm_logging: true,
    log_profile_names: ['log local'],

    // shape's Integrated Bot Defense
    ibd_profile_name: '/Common/bd'
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
                class: 'Service_UDP',
                virtualAddresses: [view.virtual_address],
                virtualPort: view.virtual_port,
                pool: 'app1_pool',
                snat: {
                    use: 'app1_snatpool'
                },
                persistenceMethods: ['source-address'],
                profileUDP: {
                    bigip: '/Common/udp'
                },
                iRules: [
                    {
                        bigip: 'example_irule'
                    }
                ],
                policyFirewallEnforced: {
                    use: 'app1_fw_policy'
                },
                securityLogProfiles: [
                    {
                        bigip: 'log local'
                    },
                    {
                        bigip: 'log local'
                    }
                ],
                profileIntegratedBotDefense: {
                    bigip: '/Common/bd'
                }
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
                monitorType: 'udp',
                interval: 30,
                timeout: 91,
                receive: '',
                send: ''
            },
            app1_snatpool: {
                class: 'SNAT_Pool',
                snatAddresses: view.snat_addresses
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
                        protocol: 'udp',
                        name: 'acceptUdpPackets',
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
            }
        }
    }
};

describe(template, function () {
    describe('new pool, snatpool, and profiles', function () {
        util.assertRendering(template, view, expected);
    });

    describe('existing monitor and no firewall', function () {
        before(() => {
            // default https pool port and existing monitor
            view.make_monitor = false;
            view.monitor_name = '/Common/monitor1';
            expected.t1.app1.app1_pool.monitors = [{ bigip: '/Common/monitor1' }];
            delete expected.t1.app1.app1_monitor;

            // no firewall
            view.enable_firewall = false;
            delete expected.t1.app1.app1.policyFirewallEnforced;
            delete expected.t1.app1.app1_fw_policy;
            delete expected.t1.app1.app1_fw_rules;
            delete expected.t1.app1.app1_fw_allow_list;
            delete expected.t1.app1.default_fw_deny_list;
            view.enable_asm_logging = false;
            delete expected.t1.app1.app1.securityLogProfiles;
        });
        util.assertRendering(template, view, expected);
    });

    describe('snat automap, default profiles', function () {
        before(() => {
            // default https virtual port
            delete view.virtual_port;
            expected.t1.app1.app1.virtualPort = 4433;

            // snat automap
            view.snat_automap = true;
            delete expected.t1.app1.app1_snatpool;
            expected.t1.app1.app1.snat = 'auto';
        });
        util.assertRendering(template, view, expected);
    });

    describe('enable fastl4', function () {
        before(() => {
            view.fastl4 = true;
            expected.t1.app1.app1.class = 'Service_L4';
            expected.t1.app1.app1.profileL4 = 'basic';
            delete expected.t1.app1.app1.profileIntegratedBotDefense;
            delete expected.t1.app1.app1.profileUDP;
        });
        util.assertRendering(template, view, expected);
    });

    const monitorAttrs = ['monitor_interval'];
    monitorTests.run(util, template, view, expected, monitorAttrs, '/Common/udp');
    poolTests.run(util, template, view, expected);

    describe('clean up', function () {
        util.cleanUp();
    });
});
