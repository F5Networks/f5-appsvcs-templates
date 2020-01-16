'use strict';

const http = require('http');

const makeRequest = (opts, payload) => {
    const defaultOpts = {
        host: 'localhost',
        port: 8100,
        headers: {
            Authorization: `Basic ${Buffer.from('admin:').toString('base64')}`,
            'Content-Type': 'application/json'
        }
    };
    const combOpts = Object.assign({}, defaultOpts, opts);

    return new Promise((resolve, reject) => {
        const req = http.request(combOpts, (res) => {
            const buffer = [];
            res.setEncoding('utf8');
            res.on('data', (data) => {
                buffer.push(data);
            });
            res.on('end', () => {
                let body = buffer.join('');
                body = body || '{}';
                try {
                    body = JSON.parse(body);
                } catch (e) {
                    return reject(new Error(`Invalid response object from ${combOpts.method} to ${combOpts.path}`));
                }
                return resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body
                });
            });
        });

        req.on('error', (e) => {
            reject(new Error(`${opts.host}:${e.message}`));
        });

        if (payload) req.write(JSON.stringify(payload));
        req.end();
    });
};

const makeGet = path => makeRequest({
    path,
    method: 'GET'
}, {});

const makePost = (path, payload) => makeRequest({
    path,
    method: 'POST'
}, payload);

const makePatch = (path, payload) => makeRequest({
    path,
    method: 'PATCH'
}, payload);

module.exports = {
    makeRequest,
    makeGet,
    makePost,
    makePatch
};
