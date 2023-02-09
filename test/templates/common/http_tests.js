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
    monitor_expected_response: '200 OK',

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
    log_profile_names: ['log local'],

    // shape's Integrated Bot Defense
    ibd_profile_name: '/Common/bd'
};

const getView = {
    run: () => JSON.parse(JSON.stringify(view))
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
                    },
                    {
                        bigip: 'log local'
                    }
                ],
                profileIntegratedBotDefense: {
                    bigip: '/Common/bd'
                },
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

const getExpected = {
    run: () => JSON.parse(JSON.stringify(expected))
};

module.exports = { getView, getExpected };
