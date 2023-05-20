const monitorTests = {
    run: (util, template, view, expected, customAttrs, existingMonitor) => {
        describe('use existing monitor', () => {
            before(() => {
                customAttrs.forEach(attr => delete view[attr]);
                view.make_monitor = false;
                view.monitor_name = existingMonitor;
                expected.t1.app1.app1_pool.monitors = [{ bigip: view.monitor_name }];
                delete expected.t1.app1.app1_monitor;
            });
            util.assertRendering(template, view, expected);
        });

        describe('no monitor', () => {
            before(() => {
                delete view.monitor_name;
                view.enable_monitor = false;
                delete expected.t1.app1.app1_pool.monitors;
            });
            util.assertRendering(template, view, expected);
        });
    }
};

const poolTests = {
    run: (util, template, view, expected) => {
        describe('Service Discovery AWS members', () => {
            before(() => {
                view.use_sd = true;
                view.use_static_members = false;
                view.service_discovery = [
                    // default values and  minimum requirements
                    {
                        sd_port: 80,
                        sd_type: 'aws',
                        sd_tag_key: 'tagKey',
                        sd_tag_val: 'tagVal',
                        sd_addressRealm: 'private',
                        sd_undetectableAction: 'remove'
                    },
                    // with every field set to non-default values
                    {
                        sd_port: 8080,
                        sd_type: 'aws',
                        sd_tag_key: 'tagKey',
                        sd_tag_val: 'tagVal',
                        sd_accessKeyId: 'Access Key ID',
                        sd_secretAccessKey: 'secret access key',
                        sd_addressRealm: 'public',
                        sd_credentialUpdate: true,
                        sd_minimumMonitors: '0',
                        sd_aws_region: 'region',
                        sd_externalId: 'ExtID',
                        sd_roleARN: 'RoleARN',
                        sd_undetectableAction: 'disable',
                        sd_updateInterval: '3600'
                    }
                ];
                expected.t1.app1.app1_pool.members = [
                    {
                        servicePort: 80,
                        addressDiscovery: 'aws',
                        tagKey: 'tagKey',
                        tagValue: 'tagVal',
                        addressRealm: 'private',
                        undetectableAction: 'remove',
                        shareNodes: true
                    },
                    {
                        servicePort: 8080,
                        addressDiscovery: 'aws',
                        tagKey: 'tagKey',
                        tagValue: 'tagVal',
                        accessKeyId: 'Access Key ID',
                        secretAccessKey: 'secret access key',
                        addressRealm: 'public',
                        credentialUpdate: true,
                        minimumMonitors: '0',
                        region: 'region',
                        externalId: 'ExtID',
                        roleARN: 'RoleARN',
                        undetectableAction: 'disable',
                        updateInterval: '3600',
                        shareNodes: true
                    }
                ];
            });
            util.assertRendering(template, view, expected);
        });

        describe('Service Discovery Azure members', () => {
            before(() => {
                view.use_sd = true;
                view.use_static_members = false;
                view.service_discovery = [
                    // default values and  minimum requirements
                    {
                        sd_port: 80,
                        sd_type: 'azure',
                        sd_rg: 'rg',
                        sd_sid: 'sid',
                        sd_rid: 'rid',
                        sd_rtype: 'tag',
                        sd_dirid: 'dirid',
                        sd_appid: 'appid',
                        sd_addressRealm: 'private',
                        sd_undetectableAction: 'remove'
                    },
                    // with every field set to non-default values,
                    //  5 fields are omitted from the declaration:
                    //   sd_dirid, sd_appid, sd_apikey,
                    //  sd_azure_tag_key and sd_azure_tag_val
                    // because of sd_rid/sd_rtype and sd_useManagedIdentity
                    {
                        sd_port: 8080,
                        sd_type: 'azure',
                        sd_rg: 'rg',
                        sd_sid: 'sid',
                        sd_rid: 'rid',
                        sd_rtype: 'scaleSet',
                        sd_dirid: 'dirid',
                        sd_appid: 'appid',
                        sd_apikey: 'apikey',
                        sd_addressRealm: 'public',
                        sd_credentialUpdate: true,
                        sd_environment: 'env',
                        sd_minimumMonitors: '1',
                        sd_azure_tag_key: 'tagKey',
                        sd_azure_tag_val: 'tagVal',
                        sd_undetectableAction: 'disable',
                        sd_updateInterval: '3600',
                        sd_useManagedIdentity: true
                    },
                    {
                        sd_port: 8080,
                        sd_type: 'azure',
                        sd_rg: 'rg',
                        sd_sid: 'sid',
                        sd_dirid: 'dirid',
                        sd_appid: 'appid',
                        sd_apikey: 'apikey',
                        sd_addressRealm: 'public',
                        sd_credentialUpdate: true,
                        sd_environment: 'env',
                        sd_minimumMonitors: '1',
                        sd_azure_tag_key: 'tagKey',
                        sd_azure_tag_val: 'tagVal',
                        sd_undetectableAction: 'disable',
                        sd_updateInterval: '3600'
                    }
                ];
                expected.t1.app1.app1_pool.members = [
                    {
                        servicePort: 80,
                        addressDiscovery: 'azure',
                        resourceGroup: 'rg',
                        subscriptionId: 'sid',
                        resourceId: 'rid',
                        resourceType: 'tag',
                        directoryId: 'dirid',
                        applicationId: 'appid',
                        addressRealm: 'private',
                        undetectableAction: 'remove',
                        shareNodes: true
                    },
                    // when useManagedIdentity is true
                    //  3 otherwise required fields are ignored:
                    //   directoryId, applicationId and apiAccessKey
                    //  when resourceId and resourceType are set
                    // we ignore any value supplied for tagKey and tagValue
                    {
                        servicePort: 8080,
                        addressDiscovery: 'azure',
                        resourceGroup: 'rg',
                        subscriptionId: 'sid',
                        resourceId: 'rid',
                        resourceType: 'scaleSet',
                        addressRealm: 'public',
                        credentialUpdate: true,
                        environment: 'env',
                        minimumMonitors: 1,
                        undetectableAction: 'disable',
                        updateInterval: 3600,
                        useManagedIdentity: true,
                        shareNodes: true
                    },
                    {
                        servicePort: 8080,
                        addressDiscovery: 'azure',
                        resourceGroup: 'rg',
                        subscriptionId: 'sid',
                        directoryId: 'dirid',
                        applicationId: 'appid',
                        apiAccessKey: 'apikey',
                        addressRealm: 'public',
                        credentialUpdate: true,
                        environment: 'env',
                        minimumMonitors: 1,
                        tagKey: 'tagKey',
                        tagValue: 'tagVal',
                        undetectableAction: 'disable',
                        updateInterval: 3600,
                        shareNodes: true
                    }
                ];
            });
            util.assertRendering(template, view, expected);
        });

        describe('Service Discovery Consul members', () => {
            before(() => {
                view.use_sd = true;
                view.use_static_members = false;
                view.service_discovery = [
                    // default values and  minimum requirements
                    {
                        sd_port: 80,
                        sd_type: 'consul',
                        sd_uri: 'f5.com',
                        sd_addressRealm: 'private',
                        sd_undetectableAction: 'remove'
                    },
                    // with every field set to non-default values
                    {
                        sd_port: 8080,
                        sd_type: 'consul',
                        sd_uri: 'f5.com',
                        sd_addressRealm: 'public',
                        sd_credentialUpdate: true,
                        sd_encodedToken: 'encodedToken',
                        sd_jmesPathQuery: 'JMESPath',
                        sd_minimumMonitors: '0',
                        sd_rejectUnauthorized: true,
                        sd_trustCA: '/Common/default.crt',
                        sd_undetectableAction: 'disable',
                        sd_updateInterval: '3600'
                    }
                ];
                expected.t1.app1.app1_pool.members = [
                    {
                        servicePort: 80,
                        addressDiscovery: 'consul',
                        uri: 'f5.com',
                        addressRealm: 'private',
                        undetectableAction: 'remove',
                        shareNodes: true
                    },
                    {
                        servicePort: 8080,
                        addressDiscovery: 'consul',
                        uri: 'f5.com',
                        addressRealm: 'public',
                        credentialUpdate: true,
                        encodedToken: 'encodedToken',
                        jmesPathQuery: 'JMESPath',
                        minimumMonitors: '0',
                        rejectUnauthorized: true,
                        trustCA: { bigip: '/Common/default.crt' },
                        undetectableAction: 'disable',
                        updateInterval: '3600',
                        shareNodes: true
                    }
                ];
            });
            util.assertRendering(template, view, expected);
        });

        describe('Service Discovery Event members', () => {
            before(() => {
                view.use_sd = true;
                view.use_static_members = false;
                view.service_discovery = [
                    // default values and  minimum requirements
                    {
                        sd_port: 80, sd_type: 'event'
                    }
                ];
                expected.t1.app1.app1_pool.members = [
                    {
                        servicePort: 80, addressDiscovery: 'event', shareNodes: true
                    }
                ];
            });
            util.assertRendering(template, view, expected);
        });

        describe('Service Discovery FQDN members', () => {
            before(() => {
                view.use_sd = true;
                view.use_static_members = false;
                view.service_discovery = [
                    // default values and  minimum requirements
                    {
                        sd_port: 80, sd_type: 'fqdn', sd_host: 'f5.com'
                    },
                    // with every field set to non-default values
                    {
                        sd_port: 8080,
                        sd_type: 'fqdn',
                        sd_host: 'f5.com',
                        sd_fqdnPrefix: 'pre',
                        sd_autoPopulate: true,
                        sd_downInterval: '60',
                        sd_queryInterval: '60'
                    }
                ];
                expected.t1.app1.app1_pool.members = [
                    {
                        servicePort: 80,
                        addressDiscovery: 'fqdn',
                        hostname: 'f5.com',
                        shareNodes: true
                    },
                    {
                        servicePort: 8080,
                        addressDiscovery: 'fqdn',
                        hostname: 'f5.com',
                        fqdnPrefix: 'pre',
                        autoPopulate: true,
                        downInterval: 60,
                        queryInterval: 60,
                        shareNodes: true
                    }
                ];
            });
            util.assertRendering(template, view, expected);
        });

        describe('Service Discovery GCE members', () => {
            before(() => {
                view.use_sd = true;
                view.use_static_members = false;
                view.service_discovery = [
                    // default values and  minimum requirements
                    {
                        sd_port: 80,
                        sd_type: 'gce',
                        sd_tag_key: 'tagKey',
                        sd_tag_val: 'tagVal',
                        sd_region: 'region',
                        sd_addressRealm: 'private',
                        sd_undetectableAction: 'remove'
                    },
                    // with every field set to non-default values
                    {
                        sd_port: 8080,
                        sd_type: 'gce',
                        sd_tag_key: 'tagKey',
                        sd_tag_val: 'tagVal',
                        sd_region: 'region',
                        sd_addressRealm: 'public',
                        sd_credentialUpdate: true,
                        sd_encodedCredentials: 'encodedCreds',
                        sd_minimumMonitors: '2',
                        sd_projectId: 'projID',
                        sd_undetectableAction: 'disable',
                        sd_updateInterval: '3600'
                    }
                ];
                expected.t1.app1.app1_pool.members = [
                    {
                        servicePort: 80,
                        addressDiscovery: 'gce',
                        tagKey: 'tagKey',
                        tagValue: 'tagVal',
                        region: 'region',
                        addressRealm: 'private',
                        undetectableAction: 'remove',
                        shareNodes: true
                    },
                    {
                        servicePort: 8080,
                        addressDiscovery: 'gce',
                        tagKey: 'tagKey',
                        tagValue: 'tagVal',
                        region: 'region',
                        addressRealm: 'public',
                        credentialUpdate: true,
                        encodedCredentials: 'encodedCreds',
                        minimumMonitors: '2',
                        projectId: 'projID',
                        undetectableAction: 'disable',
                        updateInterval: '3600',
                        shareNodes: true
                    }
                ];
            });
            util.assertRendering(template, view, expected);
        });

        describe('use existing pool', () => {
            before(() => {
                delete view.pool_members;
                delete view.load_balancing_mode;
                delete view.slow_ramp_time;
                view.make_pool = false;
                view.pool_name = '/Common/pool1';
                expected.t1.app1.app1.pool = { bigip: '/Common/pool1' };
                delete expected.t1.app1.app1_pool;
            });
            util.assertRendering(template, view, expected);
        });

        describe('no pool', () => {
            before(() => {
                delete view.pool_name;
                view.enable_pool = false;
                delete expected.t1.app1.app1.pool;
            });
            util.assertRendering(template, view, expected);
        });
    }
};

const httpTests = {
    run: (util, template, view, expected) => {
        describe('tls bridging with new pool, snatpool, and profiles', () => {
            util.assertRendering(template, view, expected);
        });

        describe('tls bridging with existing https monitor, snatpool, and profiles', () => {
            before(() => {
                // existing TLS profiles
                view.make_tls_server_profile = false;
                view.tls_server_profile_name = '/Common/clientssl';
                delete expected.t1.app1.app1_tls_server;
                delete expected.t1.app1.app1_certificate;
                expected.t1.app1.app1.serverTLS = { bigip: '/Common/clientssl' };
                view.make_tls_client_profile = false;
                view.tls_client_profile_name = '/Common/serverssl';
                delete expected.t1.app1.app1_tls_client;
                expected.t1.app1.app1.clientTLS = { bigip: '/Common/serverssl' };

                // existing https monitor
                view.make_monitor = false;
                view.monitor_name_https = '/Common/https';
                expected.t1.app1.app1_pool.monitors = [{ bigip: '/Common/https' }];
                delete expected.t1.app1.app1_monitor;

                // existing caching, compression, and multiplex profiles
                delete expected.t1.app1.app1_http;
                view.make_http_profile = false;
                view.http_profile_name = '/Common/http1';
                expected.t1.app1.app1.profileHTTP = { bigip: '/Common/http1' };
                view.make_acceleration_profile = false;
                view.acceleration_profile_name = '/Common/caching1';
                expected.t1.app1.app1.profileHTTPAcceleration = { bigip: '/Common/caching1' };
                view.make_compression_profile = false;
                view.compression_profile_name = '/Common/compression1';
                expected.t1.app1.app1.profileHTTPCompression = { bigip: '/Common/compression1' };
                view.make_multiplex_profile = false;
                view.multiplex_profile_name = '/Common/oneconnect1';
                expected.t1.app1.app1.profileMultiplex = { bigip: '/Common/oneconnect1' };

                // existing analytics profiles
                view.make_analytics_profile = false;
                view.use_http_analytics_profile = true;
                view.analytics_existingHttpProfile = '/Common/analytics';
                expected.t1.app1.app1.profileAnalytics = { bigip: '/Common/analytics' };
                delete expected.t1.app1.app1_analytics;
                view.use_tcp_analytics_profile = true;
                view.analytics_existing_tcp_profile = '/Common/tcp-analytics';
                expected.t1.app1.app1.profileAnalyticsTcp = { bigip: '/Common/tcp-analytics' };
                delete expected.t1.app1.app1_tcp_analytics;

                // existing DOS & staging profiles
                view.enable_dos = true;
                view.dos_profile = '/Common/dos1';
                expected.t1.app1.app1.profileDOS = { bigip: '/Common/dos1' };
                view.enable_firewall_staging_policy = true;
                view.firewall_staging_policy = '/Common/staging1';
                expected.t1.app1.app1.policyFirewallStaged = { bigip: '/Common/staging1' };
            });
            util.assertRendering(template, view, expected);
        });

        describe('tls offload with snat automap and default profiles', () => {
            before(() => {
                // default https virtual port
                view.virtual_port = 443;
                expected.t1.app1.app1.virtualPort = 443;

                // remove TLS client
                view.enable_tls_client = false;
                delete expected.t1.app1.app1.clientTLS;

                // existing http monitor
                view.make_monitor = false;
                view.monitor_name_http = '/Common/http';
                expected.t1.app1.app1_pool.monitors = [{ bigip: '/Common/http' }];

                // snat automap
                view.snat_automap = true;
                delete expected.t1.app1.app1_snatpool;
                expected.t1.app1.app1.snat = 'auto';

                // default caching, compression, and multiplex profiles
                delete view.acceleration_profile_name;
                view.make_acceleration_profile = true;
                expected.t1.app1.app1.profileHTTPAcceleration = 'basic';
                delete view.compression_profile_name;
                view.make_compression_profile = true;
                expected.t1.app1.app1.profileHTTPCompression = 'basic';
                delete view.multiplex_profile_name;
                view.make_multiplex_profile = true;
                expected.t1.app1.app1.profileMultiplex = 'basic';
            });
            util.assertRendering(template, view, expected);
        });

        describe('specified irule and endpoint policy', () => {
            before(() => {
                view.irule_names = ['/Common/my_irule'];
                view.endpoint_policy_names = ['/Common/my_policy'];
                expected.t1.app1.app1.iRules = [{
                    bigip: '/Common/my_irule'
                }];
                expected.t1.app1.app1.policyEndpoint = [{
                    bigip: '/Common/my_policy'
                }];
            });
            util.assertRendering(template, view, expected);
        });

        describe('enable fastl4', () => {
            before(() => {
                view.fastl4 = true;
                expected.t1.app1.app1.class = 'Service_L4';
                expected.t1.app1.app1.profileL4 = 'basic';
                expected.t1.app1.app1.persistenceMethods = ['source-address'];
                view.make_monitor = false;
                view.use_https_monitor = true;
                view.monitor_name_https_fastl4 = '/Common/https';
                expected.t1.app1.app1_pool.monitors = [{ bigip: view.monitor_name_https_fastl4 }];
                delete expected.t1.app1.app1_monitor;
                delete expected.t1.app1.app1.serverTLS;
                delete expected.t1.app1.app1.clientTLS;
                delete expected.t1.app1.app1.profileTCP;
                delete expected.t1.app1.app1.policyWAF;
                delete expected.t1.app1.app1_tls_server;
                delete expected.t1.app1.app1_certificate;
                delete expected.t1.app1.app1_tls_client;
                delete expected.t1.app1.app1_waf_policy;
                delete expected.t1.app1.app1.profileDOS;
                delete expected.t1.app1.app1.profileIntegratedBotDefense;
            });
            util.assertRendering(template, view, expected);
        });

        describe('use existing https monitor with fastl4', () => {
            before(() => {
                view.use_https_monitor = false;
                view.monitor_name_http_fastl4 = '/Common/http';
                expected.t1.app1.app1_pool.monitors = [{ bigip: view.monitor_name_http_fastl4 }];
            });
            util.assertRendering(template, view, expected);
        });
    }
};

module.exports = { monitorTests, poolTests, httpTests };
