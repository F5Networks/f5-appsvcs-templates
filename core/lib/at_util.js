'use strict';

const https = require('http');

const fetchKeysOfType = (t, d) => Object.keys(d).filter(k => d[k].class === t);

const listTenants = d => fetchKeysOfType('Tenant', d);
const listApplications = d => fetchKeysOfType('Application', d);

// provided for reference, why not just use d[k] directly?
// eslint-disable-next-line no-unused-vars
const getTenant = (d, k) => d[k];

const makeRequest = (opts, body) => new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    opts.headers = { 'Content-Type': 'application/json' };
    if (payload) {
        opts.headers['Content-Length'] = payload.length;
    }

    const req = https.request(opts, (res) => {
        const buffer = [];
        res.setEncoding('utf8');
        res.on('data', (data) => {
            buffer.push(data);
        });
        res.on('end', () => {
            const rawBody = buffer.join('');
            console.log(res.statusCode);
            console.log(res.headers);
            console.log(rawBody);
            const jsonBody = (() => {
                if (res.statusCode === 204) return '';
                try {
                    return JSON.parse(rawBody);
                } catch (e) {
                    // eslint-disable-next-line no-console
                    console.error(rawBody);
                    // eslint-disable-next-line no-console
                    console.error(e);
                    return reject(new Error(`Invalid Response object from ${opts.path}`));
                }
            })();

            resolve({
                opts,
                status: res.statusCode,
                headers: res.headers,
                body: jsonBody
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

    if (body) req.write(payload);

    req.end();
});

// as3 request object, intended to stream/lock later
class ATRequest {
    constructor(device) {
        this.device = device;
    }

    as3Info() {
        const device = this.device;

        const opts = {
            host: device.ipaddress,
            port: device.port,
            auth: `${device.username}:${device.password}`,
            rejectUnauthorized: false,
            path: '/mgmt/shared/appsvcs/info'
        };
        return makeRequest(opts);
    }

    declaration(tenant) {
        const device = this.device;
        const t = tenant ? `/${tenant}` : '';

        const opts = {
            host: device.ipaddress,
            port: device.port,
            auth: `${device.username}:${device.password}`,
            rejectUnauthorized: false,
            path: `/mgmt/shared/appsvcs/declare${t}`
        };

        return makeRequest(opts).then((result) => {
            if (result.status === 204) {
                result.body = {
                    class: 'ADC',
                    schemaVersion: '3.11.0'
                };
            }
            console.log('returning from as3 declaration GET', result);
            return result;
        });
    }

    declare(adc) {
        const device = this.device;
        const opts = {
            host: device.ipaddress,
            port: device.port,
            auth: `${device.username}:${device.password}`,
            rejectUnauthorized: false,
            path: '/mgmt/shared/appsvcs/declare?showHash=true',
            method: 'POST'
        };

        return makeRequest(opts, adc)
            .then((result) => {
                console.log(result);
                if (result.status >= 400) {
                    if (result.body) {
                        if (result.body.errors) {
                            throw new Error(`${result.body.message}:${result.body.errors.join(', ')}`);
                        }
                    } if (result.body.results) {
                        throw new Error(JSON.stringify(result.body.results.map(r => `${r.message}:${r.response}`)));
                    } else {
                        try {
                            throw new Error(result.body.results.map(r => `${r.message}:${r.response}`));
                        } catch (e) {
                            throw new Error(`$$$$$${JSON.stringify(result.body)}$$$$$`);
                        }
                    }
                }
                if (!result.body.declaration && result.body.class !== 'ADC') {
                    throw new Error(`report this to as3 team please${JSON.stringify(result)}`);
                }
                console.log('returning from as3 declare POST', result);
                return result;
            });
    }
}

module.exports = {
    listTenants,
    listApplications,
    ATRequest
};
