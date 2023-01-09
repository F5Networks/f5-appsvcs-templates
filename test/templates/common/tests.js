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

module.exports = { monitorTests, poolTests };
