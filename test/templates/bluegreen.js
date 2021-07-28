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

const template = 'templates/bigip-fast-templates/bluegreen.yaml';

const view = {
    tenant_name: 't1',
    app_name: 'app1',

    // virtual server
    virtual_address: '10.1.1.1',
    virtual_port: 4430,

    // snat
    enable_snat: true,
    snat_automap: false,
    snat_addresses: ['10.3.1.1', '10.3.1.2'],

    // blue-green pools
    enable_bluegreen: true,
    blue_pool: 'blue1',
    green_pool: 'green1',
    distribution: 0.75
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
                class: 'Service_L4',
                virtualAddresses: [view.virtual_address],
                virtualPort: view.virtual_port,
                snat: {
                    use: 'app1_snatpool'
                },
                persistenceMethods: [],
                profileL4: {
                    bigip: '/Common/fastL4'
                },
                iRules: [
                    'bluegreen_irule'
                ],
                pool: view.blue_pool
            },
            blue1: {
                class: 'Pool',
                loadBalancingMode: 'round-robin',
                members: [{
                    servicePort: 80,
                    addressDiscovery: 'event',
                    shareNodes: true
                }],
                monitors: ['tcp']
            },
            green1: {
                class: 'Pool',
                loadBalancingMode: 'round-robin',
                members: [{
                    servicePort: 80,
                    addressDiscovery: 'event',
                    shareNodes: true
                }],
                monitors: ['tcp']
            },
            app1_snatpool: {
                class: 'SNAT_Pool',
                snatAddresses: view.snat_addresses
            },
            bluegreen_datagroup: {
                class: 'Data_Group',
                keyDataType: 'string',
                records: [
                    {
                        key: 'distribution',
                        value: 0.75
                    },
                    {
                        key: 'blue_pool',
                        value: '/t1/app1/blue1'
                    },
                    {
                        key: 'green_pool',
                        value: '/t1/app1/green1'
                    }
                ]
            },
            bluegreen_irule: {
                class: 'iRule',
                iRule: {
                    base64: 'd2hlbiBDTElFTlRfQUNDRVBURUQgewogICAgICAgIHNldCBkaXN0cmlidXRpb24gW2NsYXNzIG1hdGNoIC12YWx1ZSAiZGlzdHJpYnV0aW9uIiBlcXVhbHMgYmx1ZWdyZWVuX2RhdGFncm91cF0KICAgICAgICBzZXQgYmx1ZV9wb29sIFtjbGFzcyBtYXRjaCAtdmFsdWUgImJsdWVfcG9vbCIgZXF1YWxzIGJsdWVncmVlbl9kYXRhZ3JvdXBdCiAgICAgICAgc2V0IGdyZWVuX3Bvb2wgW2NsYXNzIG1hdGNoIC12YWx1ZSAiZ3JlZW5fcG9vbCIgZXF1YWxzIGJsdWVncmVlbl9kYXRhZ3JvdXBdCiAgICAgICAgIHNldCByYW5kIFtleHByIHsgcmFuZCgpIH1dCiAgICAgICAgIGlmIHsgJHJhbmQgPiAkZGlzdHJpYnV0aW9uIH0geyAKICAgICAgICAgICAgIHBvb2wgJGJsdWVfcG9vbAogICAgICAgICB9IGVsc2UgewogICAgICAgICAgICAgcG9vbCAkZ3JlZW5fcG9vbAogICAgICAgICB9Cn0='
                }
            }
        }
    }
};

describe(template, function () {
    describe('new pool, snatpool, and profiles', function () {
        util.assertRendering(template, view, expected);
    });

    describe('snat automap, default port', function () {
        before(() => {
            // default https virtual port
            delete view.virtual_port;
            expected.t1.app1.app1.virtualPort = 80;

            // snat automap
            view.snat_automap = true;
            delete expected.t1.app1.app1_snatpool;
            expected.t1.app1.app1.snat = 'auto';

            // default pool
            view.enable_bluegreen = false;
            delete expected.t1.app1.app1.iRules;
        });
        util.assertRendering(template, view, expected);
    });

    describe('clean up', function () {
        util.cleanUp();
    });
});
