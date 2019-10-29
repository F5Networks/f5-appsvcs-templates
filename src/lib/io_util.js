/*
 * Copyright 2019. F5 Networks, Inc. See End User License Agreement ("EULA") for
 * license terms. Notwithstanding anything to the contrary in the EULA, Licensee
 * may copy and modify this software product for its internal business purposes.
 * Further, Licensee may upload, publish and distribute the modified version of
 * the software product on devcentral.f5.com.
 */


const http = require('http');
const logger = require('f5-logger').getInstance();

function log(remark) {
    logger.info(`mystique: ${remark}`);
}

const httpOpts = {
    host: 'localhost',
    port: 8100,
    headers: {
        'Authorization': 'Basic ' + Buffer.from('admin:').toString('base64'),
        'Content-Type': 'application/json'
    }
};

function httpRequest(opts, payload) {
    return new Promise((resolve, reject) => {
        const req = http.request(opts, (res) => {
            const buffer = [];
            // TODO: determine if this is necessary:
            // res.setEncoding('utf8');
            res.on('data', (data) => {
                buffer.push(data);
            });
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: buffer.join('')
                });
            });
        });

        req.on('error', (e) => {
            console.error(e);
            reject(new Error(`${opts.host}:${e.message}`));
        });

        if (payload) req.write(JSON.stringify(payload));
        req.end();
    });
}

function httpGet(path) {
    let opts = httpOpts;
    opts.path = path;
    return httpRequest(opts);
}

function httpPost(path, payload) {
    let opts = httpOpts;
    opts.path = path;
    opts.method = 'POST';
    return httpRequest(opts, payload);
}

function httpPatch(path, payload) {
    let opts = httpOpts;
    opts.path = path;
    opts.method = 'PATCH';
    return httpRequest(opts, payload);
}

// LX block status controls the ball color shown in the BIG-IP UI.
// When at least one mustache app is deployed, set state to BOUND (green).
// When all are deleted, set state to UNBOUND (gray).
// TODO: resolve(block.id), refactor as (state, blockName) and if blockName is undefined, use stored blockId.
function setLxBlockStatus(blockName, state) {
    const blockData = {
        'name': blockName,
        'state': 'UNBOUND',
        'configurationProcessorReference': {
            'link': 'https://localhost/mgmt/shared/iapp/processors/noop'
        },
        'presentationHtmlReference': {
            'link': 'https://localhost/iapps/mystique/index.html'
        }
    };

    return httpGet('/shared/iapp/blocks')
        .then((res) => {
            if (res.status == 200) {
                let body = JSON.parse(res.body);
                let noBlockFound = true;
                body.items.forEach(block => {
                    if (block.name === blockName) {
                        noBlockFound = false;
                        if (state !== undefined && state !== block.state) {
                            httpPatch(`/shared/iapp/blocks/${block.id}`, { 'state': state });
                        }
                    }
                });
                if (noBlockFound) {
                    httpPost('/shared/iapp/blocks', blockData);
                }
            }
        });
}

module.exports = {
    log,
    httpGet,
    httpPost,
    setLxBlockStatus
};
