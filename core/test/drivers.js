/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const nock = require('nock');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const { NullDriver, AS3Driver } = require('../lib/drivers');

describe('Null Driver tests', function () {
    it('add_app', function () {
        const driver = new NullDriver();
        const appDef = {
            name: 'appy'
        };

        return assert.becomes(driver.listApplications(), [])
            .then(() => {
                driver.createApplication('appy', appDef);
            })
            .then(() => assert.becomes(driver.listApplications(), ['appy']))
            .then(() => assert.becomes(driver.getApplication('appy'), appDef));
    });
});

describe('AS3 Driver tests', function () {
    afterEach(function () {
        nock.cleanAll();
    });
    it('add_app', function () {
        const driver = new AS3Driver();
        const appDef = {
            tenantName: {
                class: 'Tenant',
                appName: {
                    class: 'Application'
                }
            }
        };

        nock('http://localhost:8100')
            .post('/mgmt/shared/appsvcs/declare', 'async=true')
            .reply(204, {});
        return assert.becomes(driver.listApplications(), [])
            .then(() => {
                driver.createApplication('appy', appDef);
            })
            .then(() => assert.becomes(driver.listApplications(), ['appy']))
            .then(() => assert.becomes(driver.getApplication('appy'), appDef));
    });
});
