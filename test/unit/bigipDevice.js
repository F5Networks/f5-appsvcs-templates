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
    const deviceGroupItems = [
        {
            name: 'device_trust_group',
            partition: 'Common'
        },
        {
            name: 'gtm',
            partition: 'Common'
        },
        {
            name: 'datasync-global-dg',
            partition: 'Common'
        },
        {
            name: 'dos-global-dg',
            partition: 'Common'
        },
        {
            name: 'sync_failover_dg',
            partition: 'Common'
        }
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
    let deviceInfoScope;
    let syncStatusScope;

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
                                    description: `${status}`
                                }
                            }
                        }
                    }
                }
            });
    }

    beforeEach(function () {
        this.clock = sinon.useFakeTimers();

        syncStatusScope = resetSyncStatusScope('Standalone', host);

        deviceInfoScope = nock(host)
            .persist()
            .get('/mgmt/shared/identified-devices/config/device-info')
            .reply(200, {
                mcpDeviceName: '/Common/bigip.a'
            });

        nock(host)
            .persist()
            .get('/mgmt/tm/cm/device-group')
            .reply(200, {
                items: deviceGroupItems
            });

        nock(host)
            .persist()
            .get('/mgmt/tm/cm/device-group/sync_failover_dg/stats')
            .reply(200, {
                entries: dgStatEntries
            });
    });

    afterEach(function () {
        nock.cleanAll();
        this.clock.restore();
    });

    describe('BigipDeviceClassic methods', function () {
        it('getSyncStatus', function () {
            const bigip = new BigipDeviceClassic();

            return bigip.getSyncStatus()
                .then(syncStatus => assert.equal(syncStatus, 'Standalone'));
        });

        it('getDeviceInfo', function () {
            const bigip = new BigipDeviceClassic();

            return bigip.getDeviceInfo()
                .then(deviceInfo => assert.equal(deviceInfo.mcpDeviceName, '/Common/bigip.a'));
        });

        it('getDeviceGroups', function () {
            const bigip = new BigipDeviceClassic();

            return bigip.getDeviceGroups()
                .then(deviceGroups => assert.deepStrictEqual(deviceGroups, deviceGroupItems));
        });

        it('getDeviceGroupStats', function () {
            const bigip = new BigipDeviceClassic();

            return bigip.getDeviceGroupStats('sync_failover_dg')
                .then(dgStats => assert.deepStrictEqual(dgStats, dgStatEntries));
        });

        it('watchConfigSyncStatus_standalone', function () {
            const bigip = new BigipDeviceClassic();
            bigip.getDeviceInfo = sinon.fake();

            return bigip.watchConfigSyncStatus(bigip.getDeviceInfo, true)
                .then(() => assert.isFalse(bigip.getDeviceInfo.calledOnce));
        });

        it('watchConfigSyncStatus_noChanges', function () {
            const bigip = new BigipDeviceClassic();
            bigip.onConfigSync = sinon.fake();

            resetSyncStatusScope('Changes Pending');

            return bigip.watchConfigSyncStatus(bigip.onConfigSync, true)
                .then(() => assert.isFalse(bigip.onConfigSync.calledOnce));
        });

        it('watchConfigSyncStatus_changesPending', function () {
            const bigip = new BigipDeviceClassic();
            bigip.onConfigSync = sinon.fake();

            resetSyncStatusScope('Changes Pending');

            deviceInfoScope = resetScope(deviceInfoScope)
                .persist()
                .get('/mgmt/shared/identified-devices/config/device-info')
                .reply(200, {
                    mcpDeviceName: '/Common/bigip.b'
                });

            return bigip.watchConfigSyncStatus(bigip.onConfigSync, true)
                .then(() => assert(bigip.onConfigSync.calledOnce));
        });
    });
});
