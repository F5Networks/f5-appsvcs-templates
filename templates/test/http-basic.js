/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const assert = require('assert');
const { execSync } = require('child_process');

const writeAndRender = function (view) {
    const tmplFile = 'http-basic.yml';
    const viewFile = 'tmp.json';
    const cmd = `mystique render ${tmplFile} ${viewFile}`;
    fs.writeFileSync(viewFile, JSON.stringify(view, null, 2));
    return JSON.parse(execSync(cmd).toString());
};

const view = {
    tenant: 't1',
    app: 'app1',
    virtual_addr: '10.1.1.1',
    use_irules: false,

    // misc optional fields
    virtual_port: 4430,
    hostname: 'www.example.com',

    // pool spec
    use_pool: true,
    pool: 'demo_pool',

    // monitor spec
    use_monitor: true,
    monitor: 'demo_monitor',
    send_string: '/',
    expected_response: 'OK',

    // tcp profile spec
    clientside_network: 'wan',
    serverside_network: 'lan',

    // tls profile spec
    use_tls_server: true,
    tls_server_profile: 'demo_tls_client',
    tls_certificate: 'demo_cert',
    use_tls_client: true,
    tls_client_profile: 'demo_tls_client',

    // compression profile spec
    use_compression: true,
    compression: '/Common/demo_compression'
};

const assertAS3Service = function (decl) {
    assert(typeof decl === 'object'
        && decl.class === 'ADC'
        && decl.t1.class === 'Tenant'
        && decl.t1.app1.class === 'Application'
        && decl.t1.app1.serviceMain.class === 'Service_HTTPS');
};

describe('http-basic template', function () {
    let decl;
    let svc;
    it('valid JSON with AS3 class heirarchy', () => {
        decl = writeAndRender(view);
        assertAS3Service(decl);
    });
    it('virtual address & port', () => {
        svc = decl.t1.app1.serviceMain;
        assert(svc.virtualAddresses[0] === '10.1.1.1'
            && svc.virtualPort === 4430);
    });
    it('no irules', () => { assert(svc.iRules === undefined); });
});

describe('http-basic with irules', function () {
    let decl;
    let svc;
    it('valid JSON with AS3 class heirarchy', () => {
        view.use_irules = true;
        decl = writeAndRender(view);
        // console.log(JSON.stringify(decl, null, 2));
        assertAS3Service(decl);
    });
    it('virtual address & port', () => {
        svc = decl.t1.app1.serviceMain;
        assert(svc.virtualAddresses[0] === '10.1.1.1'
            && svc.virtualPort === 4430);
    });
    it('irule', () => { assert(svc.iRules[0] === 'choose_pool'); });
});
