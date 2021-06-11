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

'use strict';

const merge = require('deepmerge');
const JSONPath = require('jsonpath-plus').JSONPath;
const Mustache = require('mustache');
const axios = require('axios');

class IpamProviders {
    constructor(options) {
        options = options || {};
        this.secretsManager = options.secretsManager;
        this.transactionLogger = options.transactionLogger;
        this.logger = options.logger;
        this.logPrefix = `FAST ${this.constructor.name}:`;
    }

    getSchemas() {
        return [this.createSchema('Generic')];
        // Infoblox support is untested
        // this.createSchema('Infoblox', {
        //     apiVersion: {
        //         title: 'API Version',
        //         type: 'string',
        //         default: 'V2.11',
        //         options: {
        //             grid_columns: 2
        //         }
        //     },
        //     network: {
        //         title: 'Network Name',
        //         type: 'string',
        //         options: {
        //             grid_columns: 3,
        //             grid_break: true
        //         }
        //     },
        //     retrieveUrl: {
        // eslint-disable-next-line max-len
        //         const: '{{host}}/wapi/{{apiVersion}}/network/{{network}}?_function=next_available_ip&_return_as_object=1',
        //         options: {
        //             hidden: true
        //         }
        //     },
        //     retrieveBody: {
        //         const: '{ "num": 1 }',
        //         options: {
        //             hidden: true
        //         }
        //     },
        //     retrievePathQuery: {
        //         const: '$.ipv4addrs[0].ipv4addr',
        //         options: {
        //             hidden: true
        //         }
        //     },
        //     releaseUrl: {
        //         const: '{{host}}/wapi/{{apiVersion}}/ipv4address/{{network}}:{{addr}}',
        //         options: {
        //             hidden: true
        //         }
        //     },
        //     releaseBody: {
        //         const: '{}',
        //         options: {
        //             hidden: true
        //         }
        //     }
        // }),
    }

    createSchema(service, overrides) {
        overrides = overrides || {};

        return {
            type: 'object',
            title: service,
            format: 'grid-strict',
            properties: merge({
                name: {
                    title: 'Name',
                    type: 'string',
                    options: {
                        grid_columns: 2,
                        grid_break: true
                    }
                },
                host: {
                    title: 'Host',
                    type: 'string',
                    options: {
                        grid_columns: 4
                    }
                },
                username: {
                    title: 'Username',
                    type: 'string',
                    options: {
                        grid_columns: 4
                    }
                },
                password: {
                    title: 'Password',
                    type: 'string',
                    format: 'password',
                    options: {
                        grid_columns: 4,
                        grid_break: true
                    }
                },
                retrieveUrl: {
                    title: 'Retrieve URL',
                    type: 'string',
                    format: 'text',
                    options: {
                        grid_columns: 4
                    }
                },
                retrieveBody: {
                    title: 'Retrieve Body',
                    type: 'string',
                    format: 'text',
                    default: '{}',
                    options: {
                        grid_columns: 4,
                        grid_break: true
                    }
                },
                retrievePathQuery: {
                    title: 'Retrieve Path Query',
                    type: 'string',
                    format: 'text',
                    default: '$',
                    options: {
                        grid_columns: 4
                    }
                },
                retrieveRefPathQuery: {
                    title: 'Retrieve Reference Path Query',
                    type: 'string',
                    format: 'text',
                    default: '',
                    options: {
                        grid_columns: 4,
                        grid_break: true
                    }
                },
                releaseUrl: {
                    title: 'Release URL',
                    type: 'string',
                    format: 'text',
                    options: {
                        grid_columns: 4
                    }
                },
                releaseBody: {
                    title: 'Release Body',
                    type: 'string',
                    format: 'text',
                    default: '{}',
                    options: {
                        grid_columns: 4
                    }
                },
                releaseMethod: {
                    title: 'Release Method',
                    enum: [
                        'get',
                        'post',
                        'put',
                        'patch',
                        'delete'
                    ],
                    default: 'post',
                    options: {
                        hidden: true
                    }
                }
            }, overrides)
        };
    }

    recordTransaction(reqid, text, promise) {
        return this.transactionLogger.enterPromise(`${reqid}@@${text}`, promise);
    }

    populateIPAMAddress(ipFromIpamProps, templateData, config, reqid, ipamAddrs) {
        let ipamChain = Promise.resolve();
        Object.entries(ipFromIpamProps).forEach(([name, prop]) => {
            let providerParam = templateData.parameters[name];
            const isParamArray = Array.isArray(providerParam);
            if (!isParamArray) {
                providerParam = [providerParam];
            }
            providerParam.forEach((providerName, index) => {
                const provider = config.ipamProviders
                    .find(p => p.name === providerName);
                if (provider) {
                    delete prop.enum;
                    if (!ipamAddrs[providerName]) {
                        ipamAddrs[providerName] = [];
                    }
                    ipamChain = ipamChain
                        .then(() => this.secretsManager.decrypt(provider.password))
                        .then(providerPassword => this.recordTransaction(
                            reqid, `fetching address from IPAM provider: ${providerName}`,
                            axios.request({
                                url: Mustache.render(provider.retrieveUrl, provider),
                                data: JSON.parse(Mustache.render(provider.retrieveBody, provider)),
                                method: 'post',
                                auth: {
                                    username: provider.username,
                                    password: providerPassword
                                }
                            })
                        ))
                        .catch((e) => {
                            const msg = e.response ? JSON.stringify({
                                url: e.response.config.url,
                                method: e.response.config.method,
                                status: e.response.status,
                                body: e.response.data
                            }, null, 2) : e.stack;
                            return Promise.reject(new Error(
                                `failed to get IP address from IPAM provider (${providerName}):\n${msg}`
                            ));
                        })
                        .then((res) => {
                            let value = '';
                            try {
                                value = JSON.parse(res.data);
                            } catch (e) {
                                value = res.data;
                            }
                            const address = JSONPath(provider.retrievePathQuery, value)[0];
                            const ref = provider.retrieveRefPathQuery && provider.retrieveRefPathQuery !== ''
                                ? JSONPath(provider.retrieveRefPathQuery, value)[0] : '';
                            if (isParamArray) {
                                templateData.parameters[name][index] = address;
                            } else {
                                templateData.parameters[name] = address;
                            }
                            ipamAddrs[providerName].push({
                                address,
                                ref
                            });
                            this.logger.info(`${this.logPrefix} retrieved address ${value} from provider "${providerName}"`);
                        });
                }
            });
        });
        return ipamChain;
    }

    releaseIPAMAddress(reqid, config, appData, excludeAddrs) {
        if (!appData.ipamAddrs) {
            return Promise.resolve();
        }
        const promises = [];
        Object.entries(appData.ipamAddrs).forEach(([providerName, addrData]) => {
            const provider = config.ipamProviders
                .filter(p => p.name === providerName)[0];
            addrData.forEach((data) => {
                const address = data.address || data;
                const addressRef = data.ref || '';
                if (!excludeAddrs || !excludeAddrs[provider.name]
                        || !excludeAddrs[provider.name].find(a => a === address)) {
                    const view = Object.assign({}, provider, {
                        address,
                        addressRef
                    });
                    promises.push(Promise.resolve()
                        .then(() => this.secretsManager.decrypt(provider.password))
                        .then(providerPassword => this.recordTransaction(
                            reqid, `releasing ${address} from IPAM provider: ${providerName}`,
                            axios.request({
                                url: Mustache.render(provider.releaseUrl, view),
                                data: JSON.parse(Mustache.render(provider.releaseBody, view)),
                                method: provider.releaseMethod || 'post',
                                auth: {
                                    username: provider.username,
                                    password: providerPassword
                                }
                            })
                        ))
                        .catch((e) => {
                            const msg = e.response ? JSON.stringify({
                                url: e.response.config.url,
                                method: e.response.config.method,
                                status: e.response.status,
                                body: e.response.data
                            }, null, 2) : e.stack;
                            this.logger.severe(
                                `${this.logPrefix} failed to release IP address from IPAM provider (${providerName}): ${msg}`
                            );
                        }));
                }
            });
        });

        return Promise.all(promises);
    }
}

module.exports = IpamProviders;
