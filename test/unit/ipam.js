/* Copyright 2021 F5 Networks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const nock = require('nock');
const IpamProviders = require('../../lib/ipam');
const { SecretsBase64 } = require('../../lib/secrets');

describe('ipam providers tests', function () {
    this.timeout(6000);
    let ipamProviders;
    const mockConfig = {
        ipamProviders: [
            {
                name: 'testProvider1',
                host: 'http://provider.test1',
                username: 'testUser1',
                password: 'dGVzdEVuY3J5cHRlZA==',
                releaseBody: '{"address": "{{address}}" }',
                releaseUrl: '{{host}}/ip/release',
                retrieveBody: '{"count":1}',
                retrievePathQuery: '$.address',
                retrieveUrl: '{{host}}/ip/reserve'
            },
            {
                name: 'testProvider2',
                host: 'http://provider.test2',
                username: 'testUser2',
                password: 'dGVzdEVuY3J5cHRlZA==',
                releaseBody: '{"address": "{{address}}" }',
                releaseUrl: '{{host}}/ip/release',
                retrieveBody: '{"count":1}',
                retrievePathQuery: '$.addresses.[0]',
                retrieveUrl: '{{host}}/ip/reserve'
            },
            {
                name: 'testProviderToken',
                host: 'http://provider.test3',
                releaseBody: '{"address": "{{address}}" }',
                releaseUrl: '{{host}}/ip/release',
                retrieveBody: '{"count":1}',
                retrievePathQuery: '$.address',
                retrieveUrl: '{{host}}/ip/reserve',
                authHeaderName: 'Authorization',
                authHeaderValue: 'Token super-secret'
            }
        ]
    };
    const mockLogger = {
        severe: () => {},
        error: () => {},
        info: () => {},
        fine: () => {},
        log: () => {}
    };
    const mockTransLogger = {
        enterPromise: (text, promise) => promise
    };

    beforeEach(() => {
        const secretsManager = new SecretsBase64();
        ipamProviders = new IpamProviders({
            secretsManager,
            logger: mockLogger,
            transactionLogger: mockTransLogger
        });
    });

    afterEach(() => {
        nock.cleanAll();
    });

    describe('populate_ipam_address', () => {
        let ipLastOctet1;
        let ipLastOctet2;
        let ipLastOctet3;
        beforeEach(() => {
            nock('http://provider.test1', {
                reqheaders: {
                    authorization: 'Basic dGVzdFVzZXIxOnRlc3RFbmNyeXB0ZWQ='
                }
            })
                .post('/ip/reserve', { count: 1 })
                .reply(200, () => {
                    ipLastOctet1 += 1;
                    return { address: `10.10.1.${ipLastOctet1}` };
                })
                .post('/ip/release')
                .reply((uri, reqBody) => {
                    if (reqBody.address === '10.10.1.99') {
                        return [400, { message: 'address expected to be excluded' }];
                    }
                    return [200, { address: reqBody.address }];
                })
                .persist();

            nock('http://provider.test2', {
                reqheaders: {
                    authorization: 'Basic dGVzdFVzZXIyOnRlc3RFbmNyeXB0ZWQ='
                }
            })
                .post('/ip/reserve', { count: 1 })
                .reply(200, () => {
                    ipLastOctet2 += 1;
                    return { addresses: [`10.10.2.${ipLastOctet2}`] };
                })
                .post('/ip/release')
                .reply(200, (uri, reqBody) => ({ address: reqBody.address }))
                .persist();

            nock('http://provider.test3', {
                reqheaders: {
                    authorization: 'Token super-secret'
                }
            })
                .post('/ip/reserve', { count: 1 })
                .reply(200, () => {
                    ipLastOctet3 += 1;
                    console.log(ipLastOctet3);
                    return { address: `10.10.3.${ipLastOctet3}` };
                })
                .post('/ip/release')
                .reply(200, (uri, reqBody) => ({ address: reqBody.address }))
                .persist();


            ipLastOctet1 = 0;
            ipLastOctet2 = 0;
            ipLastOctet3 = 0;
        });
        const assertPopulate = function (ipamProps, templateData, expAddrs) {
            const reqId = 1234;
            const ipamAddrs = {};
            return ipamProviders.populateIPAMAddress(ipamProps, templateData, mockConfig, reqId, ipamAddrs)
                .then(() => assert.deepStrictEqual(ipamAddrs, expAddrs));
        };

        it('address_single', () => {
            const ipamProps = { testIpamProp: { ipFromIpam: true } };
            const templateData = {
                parameters: {
                    testIpamProp: 'testProvider1',
                    nonIpamProp: 'somethingZZZ',
                    anotherProp: true
                }
            };
            const expectedAddrs = {
                testProvider1: [{
                    address: '10.10.1.1',
                    ref: ''
                }]
            };
            return assertPopulate(ipamProps, templateData, expectedAddrs);
        });
        it('address_array_same_provider', () => {
            const ipamProps = {
                testIpamProp: {
                    type: 'array',
                    items: {
                        oneOf: [
                            { ipFromIpam: true },
                            { ipFromIpam: false }
                        ]
                    }
                }
            };
            const templateData = {
                parameters: {
                    testIpamProp: ['testProvider1', '1.2.3.4', 'testProvider1'],
                    nonIpamProp: 'somethingZZZ',
                    anotherProp: true
                }
            };
            const expectedAddrs = {
                testProvider1: [
                    {
                        address: '10.10.1.1',
                        ref: ''
                    },
                    {
                        address: '10.10.1.2',
                        ref: ''
                    }
                ]
            };
            return assertPopulate(ipamProps, templateData, expectedAddrs);
        });
        it('address_array_different_providers', () => {
            const ipamProps = {
                testIpamProp: {
                    type: 'array',
                    items: {
                        oneOf: [
                            { ipFromIpam: true },
                            { ipFromIpam: false }
                        ]
                    }
                }
            };
            const templateData = {
                parameters: {
                    testIpamProp: ['testProvider1', '1.2.3.4', 'testProvider2'],
                    nonIpamProp: 'somethingZZZ',
                    anotherProp: true
                }
            };
            const expectedAddrs = {
                testProvider1: [{ address: '10.10.1.1', ref: '' }],
                testProvider2: [{ address: '10.10.2.1', ref: '' }]
            };
            return assertPopulate(ipamProps, templateData, expectedAddrs);
        });
        it('token_auth', () => {
            const ipamProps = { testIpamProp: { ipFromIpam: true } };
            const templateData = {
                parameters: {
                    testIpamProp: 'testProviderToken',
                    nonIpamProp: 'somethingZZZ',
                    anotherProp: true
                }
            };
            const expectedAddrs = {
                testProviderToken: [{
                    address: '10.10.3.1',
                    ref: ''
                }]
            };
            return assertPopulate(ipamProps, templateData, expectedAddrs);
        });
    });

    describe('release_ipam_address', () => {
        let releasedAddr;
        let reqThrows;
        beforeEach(() => {
            releasedAddr = [];
            const releaseFunc = function (uri, reqBody) {
                if (reqThrows) {
                    return [500, 'errored out'];
                }
                return [200, { address: reqBody.address }];
            };
            nock('http://provider.test1', {
                reqheaders: {
                    authorization: 'Basic dGVzdFVzZXIxOnRlc3RFbmNyeXB0ZWQ='
                }
            })
                .post('/ip/release', (body) => {
                    releasedAddr.push(body.address);
                    return true;
                })
                .reply(releaseFunc)
                .persist();

            nock('http://provider.test2', {
                reqheaders: {
                    authorization: 'Basic dGVzdFVzZXIyOnRlc3RFbmNyeXB0ZWQ='
                }
            })
                .post('/ip/release', (body) => {
                    releasedAddr.push(body.address);
                    return true;
                })
                .reply(releaseFunc)
                .persist();
        });
        afterEach(() => { reqThrows = false; });

        const assertRelease = function (appData, excludeAddrs, expAddrs) {
            return ipamProviders.releaseIPAMAddress(1234, mockConfig, appData, excludeAddrs)
                .then(() => {
                    assert.deepStrictEqual(releasedAddr, expAddrs);
                });
        };
        it('release_all', () => {
            const appData = {
                ipamAddrs: {
                    testProvider1: ['10.10.1.14'],
                    testProvider2: ['10.10.2.22']
                }
            };
            return assertRelease(appData, undefined, ['10.10.1.14', '10.10.2.22']);
        });
        it('release_with_exclude', () => {
            const appData = {
                ipamAddrs: {
                    testProvider1: ['10.10.1.16', '10.10.1.99'],
                    testProvider2: ['10.10.2.27']
                }
            };
            const excludeAddrs = { testProvider1: ['10.10.1.99'] };
            return assertRelease(appData, excludeAddrs, ['10.10.1.16', '10.10.2.27']);
        });
        it('failure_should_not_throw_error', () => {
            const appData = {
                ipamAddrs: { testProvider1: ['10.10.1.100'] }
            };
            reqThrows = true;
            return assertRelease(appData, undefined, ['10.10.1.100']);
        });
    });
});
