#!/usr/bin/env node
/* Copyright 2022 F5 Networks, Inc.
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

/* eslint-disable no-console */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// eslint-disable-next-line import/no-extraneous-dependencies
const yargs = require('yargs/yargs');
// eslint-disable-next-line import/no-extraneous-dependencies
const { hideBin } = require('yargs/helpers');

function createEndpointBase(bigipTarget, bigipCreds) {
    const [bigipUser, bigipPassword] = bigipCreds.split(':');

    const endpoint = axios.create({
        baseURL: `https://${bigipTarget}`,
        auth: {
            username: bigipUser,
            password: bigipPassword
        },
        httpsAgent: new https.Agent({
            rejectUnauthorized: false,
            keepAlive: true
        })
    });

    endpoint.interceptors.response.use(
        response => response,
        (err) => {
            if (!err.response) {
                return Promise.reject(err);
            }

            const resp = err.response;
            const cfg = resp.config;
            const method = cfg.method.toUpperCase();

            console.log(`${method} to ${cfg.url}:`);
            console.log(err.response.data);

            return Promise.reject(
                new Error(`Failed ${method} to ${cfg.url} (${resp.status}): ${resp.data.message}`)
            );
        }
    );

    return endpoint;
}

function createApplicationDefinition(appId, numTenants, templateWeight) {
    const ipaddr = [
        10,
        0,
        Math.floor(appId / 256),
        appId % 256
    ].join('.');

    const tenantId = appId % numTenants;
    const parameters = {
        tenant_name: `tenant${tenantId + 1}`,
        application_name: `app${appId + 1}`,
        virtual_port: 80,
        virtual_address: ipaddr,
        server_port: 80,
        server_addresses: [ipaddr],
        server_address: [ipaddr],
        certificate: '-----BEGIN CERTIFICATE-----\nMIICnDCCAgWgAwIBAgIJAJ5n2b0OCEjwMA0GCSqGSIb3DQEBCwUAMGcxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMRQwEgYDVQQKDAtmNV9OZXR3b3JrczEbMBkGA1UEAwwSc2FtcGxlLmV4YW1wbGUubmV0MB4XDTE3MTEyNjE5NTAyNFoXDTE4MDIyNTE5NTAyNFowZzELMAkGA1UEBhMCVVMxEzARBgNVBAgMCldhc2hpbmd0b24xEDAOBgNVBAcMB1NlYXR0bGUxFDASBgNVBAoMC2Y1X05ldHdvcmtzMRswGQYDVQQDDBJzYW1wbGUuZXhhbXBsZS5uZXQwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBALEsuXmSXVQpYjrZPW+WiTBjn491mwZYT7Q92V1HlSBtM6WdWlK1aZN5sovfKtOX7Yrm8xa+e4o/zJ2QYLyyv5O+t2EGN/4qUEjEAPY9mwJdfzRQy6Hyzm84J0QkTuUJ/EjNuPji3D0QJRALUTzu1UqqDCEtiN9OGyXEkh7uvb7BAgMBAAGjUDBOMB0GA1UdDgQWBBSVHPNrGWrjWyZvckQxFYWO59FRFjAfBgNVHSMEGDAWgBSVHPNrGWrjWyZvckQxFYWO59FRFjAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4GBAJeJ9SEckEwPhkXOm+IuqfbUS/RcziifBCTmVyE+Fa/j9pKSYTgiEBNdbJeBEa+gPMlQtbV7Y2dy8TKx/8axVBHiXC5geDML7caxOrAyHYBpnx690xJTh5OIORBBM/a/NvaR+P3CoVebr/NPRh9oRNxnntnqvqD7SW0U3ZPe3tJc\n-----END CERTIFICATE-----',
        private_key: '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-256-CBC,D8FFCE6B255601587CB54EC29B737D31\n\nkv4Fc3Jn0Ujkj0yRjt+gQQfBLSNF2aRLUENXnlr7Xpzqu0Ahr3jS1bAAnd8IWnsR\nyILqVmKsYF2DoHh0tWiEAQ7/y/fe5DTFhK7N4Wml6kp2yVMkP6KC4ssyYPw27kjK\nDBwBZ5O8Ioej08A5sgsLCmglbmtSPHJUn14pQnMTmLOpEtOsu6S+2ibPgSNpdg0b\nCAJNG/KHe+Vkx59qNDyDeKb7FZOlsX30+y67zUq9GQqJEDuysPJ2BUNP0IJXAjst\nFIt1qNoZew+5KDYs7u/lPxcMGTirUhgI84Jy4WcDvSOsP/tKlxj04TbIE3epmSKy\n+TihHkwY7ngIGtcm3Sfqk5jz2RXoj1/Ac3SW8kVTYaOUogBhn7zAq4Wju6Et4hQG\nRGapsJp1aCeZ/a4RCDTxspcKoMaRa97/URQb0hBRGx3DGUhzpmX9zl7JI2Xa5D3R\nmdBXtjLKYJTdIMdd27prBEKhMUpae2rz5Mw4J907wZeBq/wu+zp8LAnecfTe2nGY\nE32x1U7gSEdYOGqnwxsOexb1jKgCa67Nw9TmcMPV8zmH7R9qdvgxAbAtwBl1F9OS\nfcGaC7epf1AjJLtaX7krWmzgASHl28Ynh9lmGMdv+5QYMZvKG0LOg/n3m8uJ6sKy\nIzzvaJswwn0j5P5+czyoV5CvvdCfKnNb+3jUEN8I0PPwjBGKr4B1ojwhogTM248V\nHR69D6TxFVMfGpyJhCPkbGEGbpEpcffpgKuC/mEtMqyDQXJNaV5HO6HgAJ9F1P6v\n5ehHHTMRvzCCFiwndHdlMXUjqSNjww6me6dr6LiAPbejdzhL2vWx1YqebOcwQx3G\n-----END RSA PRIVATE KEY-----'
    };

    const WEIGHTED_TEMPLATES = {
        light: {
            name: 'examples/simple_http',
            parameters,
            allowOverwrite: true
        },
        medium: {
            name: 'examples/simple_https',
            parameters,
            allowOverwrite: true
        },
        heavy: {
            name: 'examples/simple_waf',
            parameters,
            allowOverwrite: true
        }
    };

    return WEIGHTED_TEMPLATES[templateWeight];
}

function createRange(start, stop, step) {
    if (!stop) {
        stop = start;
        start = 0;
    }
    step = step || 1;
    return Array.from(
        { length: (stop - start) / step },
        (_, idx) => start + idx * step
    );
}

function mapRange(args, func) {
    if (!args.length) {
        args = [args];
    }
    return createRange(...args).map(func);
}

function promiseDelay(timems) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), timems);
    });
}

async function setAuthToken(endpoint, refresh) {
    // console.log('Getting auth token from the BIG-IP');
    const postData = {
        username: endpoint.defaults.auth.username,
        password: endpoint.defaults.auth.password,
        loginProviderName: 'tmos'
    };
    const response = await endpoint.post('/mgmt/shared/authn/login', postData)
        .catch((e) => {
            if (!e.response || !refresh) {
                return Promise.reject(e);
            }
            return Promise.resolve();
        });

    if (response) {
        const token = response.data.token.token;
        endpoint.defaults.headers.common['X-F5-Auth-Token'] = token;
        endpoint.defaults.headers.authorization = `Bearer ${token}`;
    }

    // Automatically refresh the token before it expires
    const timeout = (response ? response.data.token.timeout * 0.5 : 100) * 1000;
    setTimeout((() => setAuthToken(endpoint)), timeout).unref();
}

async function resetBigIp(endpoint) {
    // Reset AS3 (and thus FAST)
    console.log('Resetting the BIG-IP...');
    await endpoint.delete('/mgmt/shared/appsvcs/declare');
}

async function waitForCompletedTask(endpoint, taskid) {
    if (!taskid) {
        return Promise.reject(new Error('failed to get a taskid'));
    }

    const result = await endpoint.get(`/mgmt/shared/fast/tasks/${taskid}`)
        .then(resp => resp.data);
    // console.log(`taskId ${taskid}: ${result.message}`);
    if (result.message !== 'in progress' && result.message !== 'pending') {
        return result;
    }

    await promiseDelay(100);
    return waitForCompletedTask(endpoint, taskid);
}

async function deployApps(endpoint, numApplications, numTenants, batchSize, templateWeight) {
    const deployInfo = {};
    const numBatches = Math.ceil(numApplications / batchSize);
    const appsInLastBatch = numApplications % batchSize || batchSize;
    const batches = mapRange(numBatches, (batchId) => {
        const appsInBatch = batchId === (numBatches - 1) ? appsInLastBatch : batchSize;
        const start = appsInBatch * batchId;
        const end = start + appsInBatch;
        return mapRange([start, end], x => createApplicationDefinition(x, numTenants, templateWeight));
    });

    let appsDeployed = 0;

    console.log(`Deploying ${numApplications} ${templateWeight} apps across ${numTenants} tenant(s) in ${numBatches} batch(es)`);
    /* eslint-disable no-restricted-syntax */
    for (const [batchId, batch] of batches.entries()) {
        const startTime = Date.now();
        const appsStr = batch.length === 1 ? `app ${appsDeployed + 1}` : `apps ${appsDeployed + 1} - ${appsDeployed + batch.length}`;
        console.log(`  deploying ${templateWeight} batch ${batchId + 1}/${numBatches}: ${appsStr} of ${numApplications}`);
        /* eslint-disable no-await-in-loop */
        const taskId = await endpoint.post('/mgmt/shared/fast/applications', batch)
            .then(resp => resp.data.message[0].id)
            .catch((e) => {
                if (!e.response) {
                    Promise.reject(e);
                }

                if (e.response
                    && e.response.status === 400
                    && e.response.data.kind) {
                    // Try again
                    console.log('trying again due to restjavad nonesense');
                    return endpoint.post('/mgmt/shared/fast/applications', batch)
                        .then(resp => resp.data.message[0].id);
                }

                return Promise.reject(e);
            });
        /* eslint-disable no-await-in-loop */
        await waitForCompletedTask(endpoint, taskId);

        appsDeployed += batch.length;
        const elapsedTime = (Date.now() - startTime) / 1000;
        deployInfo[batchId] = [batch.length, elapsedTime];
        console.log(`    ${batch.length} ${templateWeight} app(s) deployed in ${elapsedTime}s`);
    }

    return deployInfo;
}

function report(params, results) {
    let sumDt = 0;
    let sumApps = 0;
    console.log('\n=== Results ===\n');
    console.log(JSON.stringify(params), '\n');
    let csvContent = 'batch, apps deployed, time to deploy (s), total apps, total time (s)\n';
    console.log(csvContent);
    Object.entries(results).forEach(([batchId, [appsDeployed, dt]]) => {
        sumDt += dt;
        sumApps += appsDeployed;
        console.log(`${batchId}, ${appsDeployed}, ${dt}, ${sumApps}, ${sumDt}`);
        csvContent += `${batchId}, ${appsDeployed}, ${dt}, ${sumApps}, ${sumDt}\n`;
    });

    // writing csv file
    fs.writeFileSync(path.join(process.cwd(), `perfomance-tests-results/${params.testCaseName}_results.csv`), csvContent);
    fs.writeFileSync(path.join(process.cwd(), `perfomance-tests-results/${params.testCaseName}_metadata.json`), JSON.stringify(params));
}

async function runBench(endpoint, testCaseName, numApplications, numTenants, batchSize, templateWeight) {
    await setAuthToken(endpoint);

    await resetBigIp(endpoint);

    const results = await deployApps(endpoint, numApplications, numTenants, batchSize, templateWeight);

    report(
        {
            numApplications,
            numTenants,
            batchSize,
            testCaseName
        },
        results
    );
}

async function main(createEndpoint) {
    createEndpoint = createEndpoint || createEndpointBase;
    const argv = yargs(hideBin(process.argv))
        .alias('h', 'help')
        .options({
            testCaseName: {
                description: 'Test test case name.',
                alias: 'testName',
                type: 'string',
                default: 'default'
            },
            numApplications: {
                description: 'The number of applications to deploy',
                alias: 'n',
                type: 'number',
                default: 100
            },
            numTenants: {
                description: 'The number of tenants to spread the applications across',
                alias: 't',
                type: 'number',
                default: 1
            },
            batchSize: {
                description: 'The number of apps to deploy in a single FAST request',
                alias: 'b',
                type: 'number',
                default: 10
            },
            templateWeight: {
                description: 'The relative weight of configuration objects deployed inthe FAST template to deploy, e.g., light, medium, heavy',
                alias: 'w',
                type: 'string',
                default: 'light'
            },
            bigipTarget: {
                description: 'The IP address and port of the BIG-IP to target',
                type: 'string'
            },
            bigipCredentials: {
                description: 'The username and password of the BIG-IP in the form user:pass',
                type: 'string'
            }
        })
        .argv;

    const bigipTarget = argv.bigipTarget || process.env.BIGIP_TARGET;
    const bigipCreds = argv.bigipCredentials || process.env.BIGIP_CREDS;

    if (!bigipTarget) {
        throw new Error('BIGIP_TARGET env var needs to be defined');
    }

    if (!bigipCreds) {
        throw new Error('BIGIP_CREDS env var needs to be defined');
    }
    fs.mkdirSync(path.join(process.cwd(), 'perfomance-tests-results'), { recursive: true });
    const endpoint = createEndpoint(bigipTarget, bigipCreds);
    // eslint-disable-next-line max-len
    await runBench(endpoint, argv.testCaseName, argv.numApplications, argv.numTenants, argv.batchSize, argv.templateWeight);
}

if (require.main === module) {
    main().catch((e) => {
        console.log(e.stack || e.message);
        process.exitCode = 1;
    });
}

module.exports = {
    createEndpointBase,
    main
};
