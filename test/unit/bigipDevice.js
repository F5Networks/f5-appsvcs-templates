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

const nock = require('nock');
const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const { BigipDeviceClassic } = require('../../lib/bigipDevices');

function resetScope(scope) {
    scope.persist(false);
    scope.interceptors.forEach(nock.removeInterceptor);
    return scope;
}

describe('BigipDeviceClassic tests', function () {
    this.timeout(3000);
    const host = 'http://localhost:8100';
    let testCtx;
    const deviceGroupItems = [
        { name: 'device_trust_group', partition: 'Common' },
        { name: 'gtm', partition: 'Common' },
        { name: 'datasync-global-dg', partition: 'Common' },
        { name: 'dos-global-dg', partition: 'Common' },
        { name: 'sync_failover_dg', partition: 'Common' }
    ];
    const dgStatEntries = {
        'https://localhost/mgmt/tm/cm/device-group/syncFailover/~Common~syncFailover:~Common~bigip.a/stats': {
            nestedStats: {
                entries: {
                    device: {
                        description: '/Common/bigip.a'
                    },
                    timeSinceLastSync: {
                        description: 61
                    }
                }
            }
        },
        'https://localhost/mgmt/tm/cm/device-group/syncFailover/~Common~syncFailover:~Common~bigip.b/stats': {
            nestedStats: {
                entries: {
                    device: {
                        description: '/Common/bigip.b'
                    },
                    timeSinceLastSync: {
                        description: 59
                    }
                }
            }
        }
    };
    let syncStatusScope;
    let deviceInfoScope;
    let deviceGroupScope;
    let dgStatsScope;

    function resetSyncStatusScope(status, url = false) {
        return (url ? nock(url) : resetScope(syncStatusScope))
            .persist()
            .get('/mgmt/tm/cm/sync-status')
            .reply(200, {
                entries: {
                    'https://localhost/mgmt/tm/cm/sync-status/0': {
                        nestedStats: {
                            entries: {
                                status: {
                                    description: status
                                }
                            }
                        }
                    }
                }
            });
    }

    function resetDeviceInfoScope(deviceName, url = false) {
        return (url ? nock(url) : resetScope(deviceInfoScope))
            .persist()
            .get('/mgmt/shared/identified-devices/config/device-info')
            .reply(200, {
                mcpDeviceName: deviceName
            });
    }

    function resetDeviceGroupScope(arrItems, url = false) {
        return (url ? nock(url) : resetScope(deviceGroupScope))
            .persist()
            .get('/mgmt/tm/cm/device-group')
            .reply(200, {
                items: arrItems
            });
    }

    beforeEach(function () {
        // we store the configSync timer in a property of the bigip object
        // so there could be existing timers we will be trying to clear
        const sinonTimerConfig = { shouldClearNativeTimers: true };
        this.clock = sinon.useFakeTimers(sinonTimerConfig);

        syncStatusScope = resetSyncStatusScope('Standalone', host);
        deviceInfoScope = resetDeviceInfoScope('/Common/bigip.a', host);
        deviceGroupScope = resetDeviceGroupScope(deviceGroupItems, host);
        dgStatsScope = nock(host)
            .persist()
            .get('/mgmt/tm/cm/device-group/sync_failover_dg/stats')
            .reply(200, {
                entries: dgStatEntries
            });
        testCtx = {
            tracer: {
                startChildSpan: sinon.stub().returns({
                    log: sinon.stub(),
                    finish: sinon.stub(),
                    error: sinon.stub()
                })
            },
            span: {
                log: sinon.stub(),
                error: sinon.stub(),
                finish: sinon.stub()
            }
        };
    });

    afterEach(function () {
        nock.cleanAll();
        this.clock.restore();
    });

    describe('BigipDeviceClassic methods', function () {
        it('getSyncStatus', function () {
            const bigip = new BigipDeviceClassic();

            return bigip.getSyncStatus(testCtx)
                .then(syncStatus => assert.equal(syncStatus, 'Standalone'));
        });

        it('getDeviceInfo', function () {
            const bigip = new BigipDeviceClassic();

            return bigip.getDeviceInfo(testCtx)
                .then(deviceInfo => assert.equal(deviceInfo.mcpDeviceName, '/Common/bigip.a'));
        });

        it('getDeviceGroups', function () {
            const bigip = new BigipDeviceClassic();

            return bigip.getDeviceGroups(testCtx)
                .then(deviceGroups => assert.deepStrictEqual(deviceGroups, deviceGroupItems));
        });

        it('getDeviceGroupStats', function () {
            const bigip = new BigipDeviceClassic();

            return bigip.getDeviceGroupStats('sync_failover_dg', testCtx)
                .then(dgStats => assert.deepStrictEqual(dgStats, dgStatEntries));
        });

        it('getSharedObjects', function () {
            const bigip = new BigipDeviceClassic();
            const mockLtmMetadata = {
                kind: 'tm:ltm:pool:poolcollectionstate',
                selfLink: 'https://localhost/mgmt/tm/ltm/pool?ver=16.0.1.1',
                items: [
                    {
                        name: 'test-pool-01',
                        partition: 'Common',
                        fullPath: '/Common/test-pool-01'
                    },
                    {
                        name: 'test-pool-02',
                        partition: 'Common',
                        fullPath: '/Common/test-pool-02'
                    },
                    {
                        name: 'not-valid-name',
                        partition: 'Common',
                        fullPath: '/Common/not-valid-name'
                    }
                ]
            };
            nock(host)
                .persist()
                .get('/mgmt/tm/ltm/pool?$select=fullPath')
                .reply(200, mockLtmMetadata);
            return bigip.getSharedObjects('ltm/pool', { name: 'test' })
                .then(result => assert.deepEqual(result, ['/Common/test-pool-01', '/Common/test-pool-02']));
        });

        it('watchConfigSyncStatus Standalone', function () {
            const bigip = new BigipDeviceClassic();
            bigip.getDeviceInfo = sinon.fake();

            return bigip.watchConfigSyncStatus(bigip.getDeviceInfo, testCtx)
                .then(() => assert.isFalse(bigip.getDeviceInfo.calledOnce));
        });

        it('watchConfigSyncStatus Changes Pending', function () {
            const bigip = new BigipDeviceClassic();
            bigip.onConfigSync = sinon.fake();

            resetSyncStatusScope('Changes Pending');
            return bigip.watchConfigSyncStatus(bigip.onConfigSync, testCtx)
                .then(() => {
                    assert.isFalse(bigip.onConfigSync.calledOnce);

                    resetDeviceInfoScope('/Common/bigip.b');

                    return bigip.watchConfigSyncStatus(bigip.onConfigSync, testCtx);
                })
                .then(() => {
                    assert(bigip.onConfigSync.calledOnce);
                });
        });

        it('watchConfigSyncStatus Errors', function () {
            const bigip = new BigipDeviceClassic();
            bigip.onConfigSync = sinon.fake();

            resetSyncStatusScope('Changes Pending');
            resetDeviceGroupScope('strNotArray');

            return bigip.watchConfigSyncStatus(bigip.onConfigSync, testCtx)
                .catch(e => assert.match(e.message, /FAST BigipDevice Error in Device Group: /))
                .then(() => {
                    resetDeviceGroupScope(deviceGroupItems);
                    resetDeviceInfoScope('/Common/bigip.b');
                    resetScope(dgStatsScope)
                        .persist()
                        .get('/mgmt/tm/cm/device-group/sync_failover_dg/stats')
                        .reply(200, {
                            entries: 'strNotArray'
                        });

                    return bigip.watchConfigSyncStatus(bigip.onConfigSync, testCtx);
                })
                .catch(e => assert.match(e.message, /FAST BigipDevice Error in Device Group Stats: /));
        });
    });
});
