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

const template = 'templates/bigip-fast-templates/microsoft_exchange.yaml';

const view = {
    tenant_name: 't1',
    app_name: 'app1',

    // virtual server
    single_vip: true,
    virtual_address: '10.1.1.1',
    virtual_port: 443,

    // pool spec
    pool_members: ['10.0.0.1', '10.0.0.2'],
    pool_port: 80,
    load_balancing_mode: 'least-connections-member',
    slow_ramp_time: 300,

    // monitor spec
    eav: false,
    app_fqdn: 'example.f5net.com',
    monitor_interval: 5,

    // snat
    enable_snat: true,
    snat_automap: true,

    // tls encryption profile spec
    enable_tls_server: true,
    tls_cert_name: '/Common/default.crt',
    tls_key_name: '/Common/default.key',
    enable_tls_client: true,
    make_tls_client_profile: true,

    // services
    owa: true,
    ews: true,
    outlook: true,
    outlookMAPI: false,
    outlookRPC: false,
    activesync: true,
    autodiscover: true,
    pop3: true,
    imap4: true
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
            exchangeVS_ad_pool: {
                class: 'Pool',
                members: [
                    {
                        serverAddresses: [
                            '10.0.0.1',
                            '10.0.0.2'
                        ],
                        servicePort: 80,
                        shareNodes: true
                    }
                ],
                loadBalancingMode: 'least-connections-member',
                slowRampTime: 300,
                minimumMonitors: 1,
                monitors: [
                    {
                        use: 'exchangeVS_ad_https_monitor'
                    }
                ]
            },
            exchangeVS_as_pool: {
                class: 'Pool',
                members: [
                    {
                        serverAddresses: [
                            '10.0.0.1',
                            '10.0.0.2'
                        ],
                        servicePort: 80,
                        shareNodes: true
                    }
                ],
                loadBalancingMode: 'least-connections-member',
                slowRampTime: 300,
                minimumMonitors: 1,
                monitors: [
                    {
                        use: 'exchangeVS_as_https_monitor'
                    }
                ]
            },
            exchangeVS_ews_pool: {
                class: 'Pool',
                members: [
                    {
                        serverAddresses: [
                            '10.0.0.1',
                            '10.0.0.2'
                        ],
                        servicePort: 80,
                        shareNodes: true
                    }
                ],
                loadBalancingMode: 'least-connections-member',
                slowRampTime: 300,
                minimumMonitors: 1,
                monitors: [
                    {
                        use: 'exchangeVS_ews_https_monitor'
                    }
                ]
            },
            exchangeVS_imap4_pool: {
                class: 'Pool',
                members: [
                    {
                        serverAddresses: [
                            '10.0.0.1',
                            '10.0.0.2'
                        ],
                        servicePort: 993,
                        shareNodes: true
                    }
                ],
                loadBalancingMode: 'least-connections-member',
                slowRampTime: 300,
                minimumMonitors: 1,
                monitors: [
                    {
                        use: 'exchangeVS_imap4_tcp_monitor'
                    }
                ]
            },
            exchangeVS_pop3_pool: {
                class: 'Pool',
                members: [
                    {
                        serverAddresses: [
                            '10.0.0.1',
                            '10.0.0.2'
                        ],
                        servicePort: 995,
                        shareNodes: true
                    }
                ],
                loadBalancingMode: 'least-connections-member',
                slowRampTime: 300,
                minimumMonitors: 1,
                monitors: [
                    {
                        use: 'exchangeVS_pop3_tcp_monitor'
                    }
                ]
            },
            exchangeVS_owa_pool: {
                class: 'Pool',
                members: [
                    {
                        serverAddresses: [
                            '10.0.0.1',
                            '10.0.0.2'
                        ],
                        servicePort: 80,
                        shareNodes: true
                    }
                ],
                loadBalancingMode: 'least-connections-member',
                slowRampTime: 300,
                minimumMonitors: 1,
                monitors: [
                    {
                        use: 'exchangeVS_owa_https_monitor'
                    }
                ]
            },
            exchangeVS_ad_https_monitor: {
                interval: 10,
                send: 'GET /autodiscover/healthcheck.htm HTTP/1.1\r\nHost: example.f5net.com\r\nConnection: Close\r\n\r\n',
                receive: '200 OK',
                timeout: 31,
                class: 'Monitor',
                monitorType: 'https'
            },
            exchangeVS_as_https_monitor: {
                interval: 10,
                send: 'GET /Microsoft-Server-Activesync/healthcheck.htm HTTP/1.1\r\nHost: example.f5net.com\r\nConnection: Close\r\n\r\n',
                receive: '200 OK',
                timeout: 31,
                class: 'Monitor',
                monitorType: 'https'
            },
            exchangeVS_ews_https_monitor: {
                interval: 10,
                send: 'GET /EWS/healthcheck.htm HTTP/1.1\r\nHost: example.f5net.com\r\nConnection: Close\r\n\r\n',
                receive: '200 OK',
                timeout: 31,
                class: 'Monitor',
                monitorType: 'https'
            },
            exchangeVS_imap4_tcp_monitor: {
                send: '',
                receive: '',
                interval: 30,
                timeout: 91,
                class: 'Monitor',
                monitorType: 'tcp'
            },
            exchangeVS_pop3_tcp_monitor: {
                send: '',
                receive: '',
                interval: 30,
                timeout: 91,
                class: 'Monitor',
                monitorType: 'tcp'
            },
            exchangeVS_owa_https_monitor: {
                interval: 10,
                send: 'GET /owa/healthcheck.htm HTTP/1.1\r\nHost: example.f5net.com\r\nConnection: Close\r\n\r\n',
                receive: '200 OK',
                timeout: 31,
                class: 'Monitor',
                monitorType: 'https'
            },
            app1_tls_server: {
                class: 'TLS_Server',
                certificates: [
                    {
                        certificate: 'app1_certificate'
                    }
                ]
            },
            app1_certificate: {
                class: 'Certificate',
                certificate: {
                    bigip: '/Common/default.crt'
                },
                privateKey: {
                    bigip: '/Common/default.key'
                }
            },
            app1_tls_client: {
                class: 'TLS_Client'
            },
            app1_http: {
                class: 'HTTP_Profile',
                xForwardedFor: true
            },
            'app1_cache-optimize': {
                parentProfile: {
                    bigip: '/Common/optimized-caching'
                },
                class: 'HTTP_Acceleration_Profile',
                uriIncludeList: [
                    '.*'
                ],
                uriExcludeList: [
                    '/owa/ev.owa',
                    'oab.xml'
                ]
            },
            'app1_wan-optimized-compression': {
                class: 'HTTP_Compress',
                contentTypeIncludes: [
                    'text/(css | html | javascript | json | plain | postscript | richtext | rtf | vnd.wap.wml | vnd.wap.wmlscript | wap | wml | x-component | x-vcalendar | x-vcard | xml) ',
                    'application/(css | css-stylesheet | doc | excel | javascript | json | lotus123 | mdb | mpp | ms-excel | ms-powerpoint | ms-word | msaccess | msexcel | mspowerpoint | msproject | msword | photoshop | postscript | powerpoint | ps | psd | quarkexpress | rtf | txt | visio | vnd.excel | vnd.ms-access | vnd.ms-excel | vnd.ms-powerpoint | vnd.ms-pps | vnd.ms-project | vnd.msword | vnd.ms-works | vnd.ms-works-db | vnd.msaccess | vnd.msexcel | vnd.mspowerpoint | vnd.msword | vnd.powerpoint | vnd.visio | vnd.wap.cmlscriptc | vnd.wap.wmlc | vnd.wap.xhtml+xml | vnd.word | vsd | winword | wks | word | x-excel | x-java-jnlp-file | x-javascript | x-json | x-lotus123 | x-mdb | x-ms-excel | x-ms-project | x-mscardfile | x-msclip | x-msexcel | x-mspowerpoint | x-msproject | x-msword | x-msworks-db | x-msworks-wps | x-photoshop | x-postscript | x-powerpoint | x-ps | x-quark-express | x-rtf | x-vermeer-rpc | x-visio | x-vsd | x-wks | x-word | x-xls | x-xml | xhtml+xml | xls | xml) ',
                    'image/(photoshop | psd | x-photoshop | x-vsd)'
                ]
            },
            app1_combined_pool_irule3: {
                class: 'iRule',
                iRule: 'when HTTP_REQUEST {\n    switch -glob -- [string tolower [HTTP::path]] {  \n        "/microsoft-server-activesync*" {\n            TCP::idletime 1800\n            pool exchangeVS_as_pool\n            COMPRESS::disable\n            CACHE::disable\n            return\n        }   \n        "/owa*" {\n            \n            pool exchangeVS_owa_pool\n            return\n        }\n        "/ecp*" {\n            \n            pool exchangeVS_owa_pool\n            return\n        }   \n        "/ews*" {\n            pool exchangeVS_ews_pool\n            COMPRESS::disable\n            CACHE::disable\n            return\n        }\n        "/oab*" {\n            pool exchangeVS_ews_pool\n            persist none\n            return\n        }          \n        "/autodiscover*" {\n            pool exchangeVS_ad_pool\n            persist none\n            return\n        }   \n        default {\n            pool exchangeVS_owa_pool\n        }  \n    }\n}\nwhen HTTP_RESPONSE {\n    if { ( [HTTP::header exists "WWW-Authenticate"] &&\n        [string tolower [HTTP::header values "WWW-Authenticate"]] contains "negotiate" ) ||\n        ( [HTTP::header exists "Persistent-Auth"] &&\n        [string tolower [HTTP::header "Persistent-Auth"]] contains "true" ) } {\n        ONECONNECT::reuse disable\n        ONECONNECT::detach disable\n        NTLM::disable\n   } \n   if {[HTTP::header exists "Transfer-Encoding"]} {\n        HTTP::payload rechunk\n   }\n}'
            },
            app1_owa_redirect_irule3: {
                class: 'iRule',
                iRule: 'priority 900\nwhen HTTP_REQUEST {\n    if { ([HTTP::uri] == "/") } {\n        HTTP::redirect https://[HTTP::host]/owa/\n    }\n}'
            },
            app1_oneconnect_irule3: {
                class: 'iRule',
                iRule: 'when HTTP_RESPONSE {\n    if { ( [HTTP::header exists "WWW-Authenticate"] &&\n        [string tolower [HTTP::header values "WWW-Authenticate"]] contains "negotiate" ) ||\n        ( [HTTP::header exists "Persistent-Auth"] &&\n        [string tolower [HTTP::header "Persistent-Auth"]] contains "true" ) } {\n        ONECONNECT::reuse disable\n        ONECONNECT::detach disable\n        NTLM::disable\n   }\n   if {[HTTP::header exists "Transfer-Encoding"]} {\n        HTTP::payload rechunk\n   }\n}'
            },
            app1_pop3_vs: {
                virtualAddresses: [
                    '10.1.1.1'
                ],
                pool: 'exchangeVS_pop3_pool',
                virtualPort: 995,
                class: 'Service_TCP',
                serverTLS: 'app1_tls_server',
                clientTLS: 'app1_tls_client',
                snat: 'auto',
                profileTCP: 'normal'
            },
            app1_imap4_vs: {
                virtualAddresses: [
                    '10.1.1.1'
                ],
                pool: 'exchangeVS_imap4_pool',
                virtualPort: 993,
                class: 'Service_TCP',
                serverTLS: 'app1_tls_server',
                clientTLS: 'app1_tls_client',
                snat: 'auto',
                profileTCP: 'normal'
            },
            app1_vs: {
                virtualAddresses: [
                    '10.1.1.1'
                ],
                virtualPort: 443,
                class: 'Service_HTTPS',
                serverTLS: 'app1_tls_server',
                clientTLS: 'app1_tls_client',
                profileHTTP: {
                    use: 'app1_http'
                },
                persistenceMethods: [],
                snat: 'auto',
                profileHTTPAcceleration: {
                    use: 'app1_cache-optimize'
                },
                profileHTTPCompression: {
                    use: 'app1_wan-optimized-compression'
                },
                profileMultiplex: 'basic',
                profileNTLM: {
                    bigip: '/Common/ntlm'
                },
                redirect80: true,
                iRules: [
                    {
                        use: 'app1_owa_redirect_irule3'
                    },
                    {
                        use: 'app1_combined_pool_irule3'
                    }
                ],
                profileTCP: 'normal'
            }
        }
    }
};

describe(template, function () {
    describe('tls bridging with a common virtual address', function () {
        util.assertRendering(template, view, expected);
    });

    describe('clean up', function () {
        util.cleanUp();
    });
});
