'use strict';

const https = require('https');

const makeRequest = (opts, body) => new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
        const buffer = [];
        res.setEncoding('utf8');
        res.on('data', (data) => {
            buffer.push(data);
        });
        res.on('end', () => {
            const rawBody = buffer.join('');

            resolve({
                opts,
                status: res.statusCode,
                headers: res.headers,
                body: rawBody
            });
        });
    });

    req.on('error', (e) => {
        // eslint-disable-next-line no-console
        console.error(`ERROR: Could not connect to ${opts.host} on port ${opts.port}`);
        // eslint-disable-next-line no-console
        console.error(e);
        reject(new Error(`${opts.host}:${e.message}`));
    });

    if (body) req.write(JSON.stringify(body));

    req.end();
});

function ResourceCache(asyncFetch) {
    // used for caching AS3 TemplateEngine objects
    this.cached = {};
    this.cache_limit = 100;
    this.asyncFetch = asyncFetch;
    return this;
}

ResourceCache.prototype.fetch = function fetch(key) {
    return (() => {
        if (!this.cached[key]) {
            return this.asyncFetch(key)
                .then((resource) => {
                    this.cached[key] = resource;
                    const allKeys = Object.keys(this.cached);
                    const oldestKey = allKeys.shift();
                    if (allKeys.length > this.cache_limit) delete this.cached[oldestKey];
                    return resource;
                });
        }
        return Promise.resolve(this.cached[key]);
    })();
};

module.exports = {
    makeRequest,
    ResourceCache
};
