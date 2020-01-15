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
            .then(() => driver.createApplication(appDef))
            .then(() => assert.becomes(driver.listApplications(), ['appy']))
            .then(() => assert.becomes(driver.getApplication('appy'), appDef));
    });
});

describe('AS3 Driver tests', function () {
    const appDef = {
        tenantName: {
            class: 'Tenant',
            appName: {
                class: 'Application'
            }
        }
    };
    const as3ep = '/mgmt/shared/appsvcs/declare';
    const as3stub = {
        class: 'ADC',
        schemaVersion: '3.0.0'
    };
    const as3WithApp = Object.assign({}, as3stub, appDef);

    const host = 'http://localhost:8100';

    afterEach(function () {
        nock.cleanAll();
    });

    it('app_stitching', function () {
        const driver = new AS3Driver();
        const decl = Object.assign({}, as3stub);
        driver._stitchDecl(decl, appDef);
        assert.deepStrictEqual(decl, as3WithApp);
    });
    it('get_decl', function () {
        const driver = new AS3Driver();
        nock(host)
            .get(as3ep)
            .reply(200, as3stub);

        return assert.becomes(driver._getDecl(), as3stub);
    });
    it('get_decl_empty_204', function () {
        const driver = new AS3Driver();
        nock(host)
            .get(as3ep)
            .reply(204, '');

        return assert.becomes(driver._getDecl(), as3stub);
    });
    it('add_app', function () {
        const driver = new AS3Driver();
        nock(host)
            .persist()
            .get(as3ep)
            .reply(200, as3stub);

        nock(host)
            .persist()
            .post(as3ep)
            .query(true)
            .reply(202, {});

        return assert.becomes(driver.listApplications(), [])
            .then(() => driver.createApplication(appDef))
            .then(() => {
                nock.cleanAll();
                nock(host)
                    .persist()
                    .get(as3ep)
                    .reply(200, as3WithApp);
            })
            .then(() => assert.becomes(driver.listApplications(), ['tenantName:appName']))
            .then(() => assert.becomes(driver.getApplication('tenantName:appName'), appDef.tenantName.appName));
    });
});
