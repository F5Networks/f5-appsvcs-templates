import { Template } from './template';

module.exports = class SimpleUdpDefaults implements Template {
    baseTemplate:any = {
        name: 'examples/simple_udp_defaults',
        parameters: {
            tenant: 'foo',
            application_name: 'Application0',
            virtual_address: '192.0.2.2',
            virtual_port: 5554,
            server_addresses: ["192.0.2.2", "192.0.2.3"],
            service_port: 5554
        }
    }

    incrCount = 0;

    setTargetTenant(targetTenant: string) {
        this.baseTemplate.parameters.tenant = targetTenant;
    }

    incrementBaseTemplate() {
        const Utils = require('../utils/utils');
        this.baseTemplate.parameters.application_name = this.baseTemplate.parameters.application_name.replace(this.incrCount.toString(), (++this.incrCount).toString());
        this.baseTemplate.parameters.virtual_address = Utils.decrementIp(this.baseTemplate.parameters.virtual_address);
        this.baseTemplate.parameters.virtual_port--;
        for(let i = 0; i < this.baseTemplate.parameters.server_addresses.length; i++) {
            this.baseTemplate.parameters.server_addresses[i] = Utils.decrementIp(this.baseTemplate.parameters.server_addresses[i]);
        }
        this.baseTemplate.parameters.service_port--;
    }

}