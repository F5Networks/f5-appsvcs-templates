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

/* eslint-env browser */
/* eslint-disable no-console */

'use strict';

// eslint-disable-next-line import/no-extraneous-dependencies
import { createRouter, createMemoryHistory } from 'vue-router';
// eslint-disable-next-line import/no-extraneous-dependencies
import { createApp } from 'vue';

const endPointUrl = '/mgmt/shared/fast';
const userAgent = 'FASTGUI/NA';

const wait = delay => new Promise((resolve) => {
    setTimeout(resolve, delay);
});

const auth = {};

const safeFetch = (uri, opts, numAttempts) => {
    numAttempts = numAttempts || 0;

    opts = Object.assign({
        // Add any defaults here
    }, opts);

    if (auth.token) {
        if (!opts.headers) {
            opts.headers = {};
        }
        opts.headers['X-F5-Auth-Token'] = auth.token;
    }

    const printUri = uri;
    if (uri.startsWith(endPointUrl) && !uri.includes('userAgent=')) {
        uri = uri.includes('?') ? `${uri}&userAgent=${userAgent}` : `${uri}?userAgent=${userAgent}`;
    }

    return fetch(uri, opts)
        .then(response => Promise.all([
            Promise.resolve(response),
            response.text()
        ]))
        .then(([response, textData]) => {
            let data = textData;
            let isJson = false;
            try {
                data = JSON.parse(textData);
                isJson = true;
            } catch (err) {
                console.log(`Failed to parse JSON data: ${textData}`);
            }
            if (!response.ok) {
                const retry = (
                    response.status === 404
                    && (
                        data.errorStack
                        || (data.message && data.message.match(/Public URI path not registered/))
                        || (data.error && data.error.innererror && data.error.innererror.referer === 'restnoded')
                    )
                    && (!numAttempts || numAttempts < 5)
                );
                if (retry) {
                    numAttempts += 1;
                    console.log(`attempting retry ${numAttempts} to ${printUri}`);
                    return Promise.resolve()
                        .then(() => wait(1000))
                        .then(() => safeFetch(uri, opts, numAttempts));
                }
                let msg = data;
                if (data.message) {
                    msg = data.message;
                } else if (isJson) {
                    msg = JSON.stringify(data, null, 2);
                }
                return Promise.reject(new Error(
                    `Failed to get data from ${printUri}: ${response.status} ${response.statusText}\n${msg}`
                ));
            }
            return data;
        });
};

const getJSON = endPoint => safeFetch(`${endPointUrl}/${endPoint}`);

const getAuthToken = () => Promise.resolve()
    .then(() => {
        // Hacky way to get digest and timenow information. This usually gets passed around in
        // form data or as query parameters. However, this doesn't seem to get passed to a custom
        // iApps LX presentation layer. So, we pull it out of a link from the root XUI GUI.
        // eslint-disable-next-line no-restricted-globals
        const xui = parent.Xui;
        if (!xui) {
            return Promise.reject(new Error('FAST is not running embedded in the BIG-IP GUI'));
        }
        const parentLinks = Array.from(xui.getDocument().links);
        const iAppsLXLink = parentLinks.filter(x => x.href.match(/applications\?_bufval/))[0];
        const params = iAppsLXLink.href.split('?')[1]
            .split('&')
            .reduce((acc, curr) => {
                const [name, val] = curr.split('=');
                acc[name] = decodeURIComponent(val);
                return acc;
            }, {});
        return params;
    })
    .then(params => safeFetch('/mgmt/shared/authn/login', {
        method: 'POST',
        body: JSON.stringify({
            digest: params._bufval,
            timeNow: params._timenow,
            loginProviderName: 'tmos',
            needsToken: true
        })
    }))
    .then(results => results.token.token)
    .catch((e) => {
        console.log(`Could not acquire BIG-IP auth token: ${e.message}`);
        // if (retryAuth <= 2) {
        //     retryAuth += 1;
        //     console.log(`Retrying to get auth token: ${retryAuth}`);
        //     setTimeout(() => { getAuthToken(); }, 1000);
        // }
        return Promise.resolve(null);
    });

const storeSubmissionData = (data) => {
    localStorage.setItem('submission-data', JSON.stringify(data));
};

const getSubmissionData = () => {
    const submissionData = localStorage.getItem('submission-data') || '{}';
    return JSON.parse(submissionData);
};

const appState = {
    debugOutput: '',
    foundAS3: true,
    busy: true,
    endPointUrl
};

const dispOutput = (output) => {
    if (typeof output === 'object') {
        output = JSON.stringify(output, null, 2);
    }

    if (output.length > 0) {
        console.log(output);
    }
    appState.debugOutput = output;
};

const multipartUpload = (file) => {
    const CHUNK_SIZE = 1000000;
    const uploadPart = (start, end) => {
        const opts = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Range': `${start}-${end}/${file.size}`,
                'Content-Length': (end - start) + 1,
                Connection: 'keep-alive'
            },
            body: file.slice(start, end + 1, 'application/octet-stream')
        };
        return safeFetch(`/mgmt/shared/file-transfer/uploads/${file.name}`, opts)
            .then(() => {
                if (end === file.size - 1) {
                    return Promise.resolve();
                }
                const nextStart = start + CHUNK_SIZE;
                const nextEnd = (end + CHUNK_SIZE > file.size - 1) ? file.size - 1 : end + CHUNK_SIZE;
                return uploadPart(nextStart, nextEnd);
            })
            .catch(e => Promise.reject(new Error(`Failed to upload file: ${e.message}`)));
    };

    if (CHUNK_SIZE < file.size) {
        return uploadPart(0, CHUNK_SIZE - 1);
    }
    return uploadPart(0, file.size - 1);
};

// Create and mount Vue app
const vueApp = createApp({
    data() {
        return appState;
    },
    mounted() {
        // by default token is 1200s/20min
        if (auth.token && auth.timeout > 1200) {
            const authTimeout = auth.timeout > 36000 ? 36000 : auth.timeout;
            const extendToken = () => safeFetch(`/mgmt/shared/authz/tokens/${auth.token}`, {
                method: 'PATCH',
                headers: {
                    'X-F5-Auth-Token': auth.token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ timeout: authTimeout })
            })
                .catch((err) => {
                    console.log(`Error extending token timeout: ${err.message}`);
                });
            extendToken();
            auth.tokenExtension = setInterval(extendToken, ((authTimeout - 120) * 1000));
        }
    },
    beforeUnmount() {
        if (auth.tokenExtension) {
            clearInterval(auth.tokenExtension);
        }
    },
    methods: {
        safeFetch(uri, opts, numAttempts) {
            return safeFetch(uri, opts, numAttempts);
        },
        getJSON(path) {
            return getJSON(path);
        },
        dispOutput(msg) {
            return dispOutput(msg);
        },
        getSubmissionData() {
            return getSubmissionData();
        },
        storeSubmissionData(data) {
            return storeSubmissionData(data);
        },
        multipartUpload(file) {
            return multipartUpload(file);
        },
        forceNav(tab) {
            this.$nextTick(() => {
                const hash = `#/${tab}`;
                Array.from(this.$refs.nav.children).forEach((anchor) => {
                    if (anchor.hash === hash) {
                        anchor.classList.add('force-link-active');
                    } else {
                        anchor.classList.remove('force-link-active');
                    }
                });
            });
        }
    }
});

// Auto-register all components in pages directory
const requireComponent = require.context(
    './pages',
    false,
    /.*\.vue$/
);
const pageComponents = {};
requireComponent.keys().forEach((fileName) => {
    const componentConfig = requireComponent(fileName);
    const component = componentConfig.default || componentConfig;
    vueApp.component(component.name, component);
    pageComponents[component.name.replace('Page', '').toLowerCase()] = component;
});

// const router = new VueRouter({
const router = createRouter({
    history: createMemoryHistory(),
    routes: [
        { path: '/', redirect: '/templates' },
        { path: '/applications', component: pageComponents.applications },
        { path: '/create/:tmplid(.*)', component: pageComponents.create },
        { path: '/modify/:appid(.*)', component: pageComponents.create },
        { path: '/resubmit/:taskid', component: pageComponents.create },
        { path: '/tasks', component: pageComponents.tasks },
        { path: '/settings', component: pageComponents.settings },
        { path: '/api', component: pageComponents.api },
        { path: '/templates', component: pageComponents.templates },
        // Fixes for embedding in TMUI
        { path: '/application/*/edit', redirect: '/' },
        { path: '/iapps/f5-appsvcs-templates/index.html', redirect: '/templates' },
        { path: '/img/fastrobot.png', redirect: '/iapps/f5-appsvcs-templates/img/fastrobot.png' },
        { path: '/*/undefined', redirect: '/#' }
    ]
});

router.beforeEach((to, from, next) => {
    appState.busy = true;
    dispOutput('');
    next();
});

vueApp.use(router);

vueApp.config.devtools = false;

Promise.resolve()
    .then(() => getAuthToken())
    .then((token) => {
        auth.token = token;
    })
    .then(() => {
        const checkAS3 = safeFetch('/mgmt/shared/appsvcs/info')
            .catch((e) => {
                appState.foundAS3 = false;
                console.log(`Error reaching AS3: ${e.message}`);
            });
        const getIdleTimeout = safeFetch('/mgmt/tm/sys/httpd', { headers: { 'X-F5-Auth-Token': auth.token } })
            .then((resp) => {
                auth.timeout = resp.authPamIdleTimeout;
            })
            .catch((e) => {
                console.log(`Error retrieving idle screen timeout ${e.message}`);
            });
        return Promise.all([checkAS3, getIdleTimeout]);
    })
    // Always attempt to mount the Vue app
    .finally(() => vueApp.mount('#vue-app'));
