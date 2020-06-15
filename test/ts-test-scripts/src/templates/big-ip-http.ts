import { Template } from './template';

module.exports = class BigIpHttp implements Template {
    baseTemplate:any = {
        name: 'bigip-fast-templates/http',
        parameters: {
            tenant_name: 'foo',
            app_name: 'Application100',
            virtual_address: '15.0.0.1',
            virtual_port: 443,
            enable_pool: false,
            enable_snat: false,
            enable_persistence: false,
            enable_tls_server: false,
            enable_tls_client: false,
            make_tcp_ingress_profile: true,
            tcp_ingress_topology: 'wan',
            make_tcp_egress_profile: true,
            tcp_egress_topology: 'lan',
            make_http_profile: true,
            x_forwarded_for: true,
            enable_acceleration: true,
            make_acceleration_profile: true,
            enable_compression: false,
            enable_multiplex: false
        }
    }

    incrCount = 0;

    setTargetTenant(targetTenant: string) {
        this.baseTemplate.parameters.tenant_name = targetTenant;
    }

    incrementBaseTemplate() {
        const Utils = require('../utils/utils');
        this.baseTemplate.parameters.app_name = this.baseTemplate.parameters.app_name.replace(this.incrCount.toString(), (++this.incrCount).toString());
        this.baseTemplate.parameters.virtual_address = Utils.decrementIp(this.baseTemplate.parameters.virtual_address);
        this.baseTemplate.parameters.virtual_port--;
    }

}