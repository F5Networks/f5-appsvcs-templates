const https = require('https');

const makeRequest = (opts, body) => new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
        const buffer = [];
        res.setEncoding('utf8');
        res.on('data', (data) => {
            buffer.push(data);
        });
        res.on('end', () => {
            const raw_body = buffer.join('');

            resolve({
                opts,
                status: res.statusCode,
                headers: res.headers,
                body: raw_body,
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

function ResourceCache(async_fetch) {
    // used for caching AS3 TemplateEngine objects
    this.cached = {};
    this.cache_limit = 100;
    this.async_fetch = async_fetch;
    return this;
}

ResourceCache.prototype.fetch = function (key) {
    return (() => {
        if (!this.cached[key]) {
            return this.async_fetch(key)
                .then((resource) => {
                    this.cached[key] = resource;
                    const all_keys = Object.keys(this.cached);
                    const oldest_key = all_keys.shift();
                    if (all_keys.length > this.cache_limit) delete this.cached[oldest_key];
                    return resource;
                });
        }
        return Promise.resolve(this.cached[key]);
    })();
};

module.exports = {
    makeRequest,
    ResourceCache,
};
