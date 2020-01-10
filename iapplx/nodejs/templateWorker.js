'use strict';

const http = require('http');

const { FsSchemaProvider, FsTemplateProvider } = require('mystique');

const projectName = 'f5-mystique';

const configPath = process.AFL_TW_ROOT || `/var/config/rest/iapps/${projectName}`;
const templatesPath = `${configPath}/templates`;
const schemasPath = `${configPath}/schemas`;


class TemplateWorker {
    constructor() {
        this.state = {};

        this.isPublic = true;
        this.isPassThrough = true;
        this.WORKER_URI_PATH = `shared/${projectName}`;
        this.schemaProvider = new FsSchemaProvider(schemasPath);
        this.templateProvider = new FsTemplateProvider(templatesPath, this.schemaProvider);

        this.httpOpts = {
            host: 'localhost',
            port: 8100,
            headers: {
                Authorization: `Basic ${Buffer.from('admin:').toString('base64')}`,
                'Content-Type': 'application/json'
            }
        };
    }

    /**
     * HTTP request utilities
     */
    httpRequest(opts, payload) {
        return new Promise((resolve, reject) => {
            const req = http.request(opts, (res) => {
                const buffer = [];
                res.setEncoding('utf8');
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
                reject(new Error(`${opts.host}:${e.message}`));
            });

            if (payload) req.write(JSON.stringify(payload));
            req.end();
        });
    }

    httpGet(path) {
        const opts = this.httpOpts;
        opts.path = path;
        return this.httpRequest(opts);
    }

    httpPost(path, payload) {
        const opts = this.httpOpts;
        opts.path = path;
        opts.method = 'POST';
        return this.httpRequest(opts, payload);
    }

    httpPatch(path, payload) {
        const opts = this.httpOpts;
        opts.path = path;
        opts.method = 'PATCH';
        return this.httpRequest(opts, payload);
    }

    /**
     * Worker Handlers
     */
    onStartCompleted(success, error, state, errMsg) {
        if (errMsg) {
            this.logger.severe(`TemplateWorker onStartCompleted error: something went wrong ${errMsg}`);
            error();
        }
        this.setLxBlockStatus(projectName)
            .then(() => {
                this.logger.fine(`TemplateWorker state loaded: ${JSON.stringify(state)}`);
                success();
            })
            .catch((err) => {
                error(err);
            });
    }

    // LX block status controls the ball color shown in the BIG-IP UI.
    // When at least one mustache app is deployed, set state to BOUND (green).
    // When all are deleted, set state to UNBOUND (gray).
    setLxBlockStatus(blockName, state) {
        const blockData = {
            name: blockName,
            state: state || 'UNBOUND',
            configurationProcessorReference: {
                link: 'https://localhost/mgmt/shared/iapp/processors/noop'
            },
            presentationHtmlReference: {
                link: `https://localhost/iapps/${projectName}/index.html`
            }
        };

        return this.httpGet('/shared/iapp/blocks')
            .then((res) => {
                if (res.status === 200) {
                    const body = JSON.parse(res.body);
                    let noBlockFound = true;
                    body.items.forEach((block) => {
                        if (block.name === blockName) {
                            noBlockFound = false;
                            if (state !== undefined && state !== block.state) {
                                this.httpPatch(`/shared/iapp/blocks/${block.id}`, {
                                    state,
                                    presentationHtmlReference: blockData.presentationHtmlReference
                                });
                            }
                        }
                    });
                    if (noBlockFound) {
                        this.httpPost('/shared/iapp/blocks', blockData);
                    }
                }
            });
    }

    /**
     * HTTP/REST handlers
     */
    genRestResponse(restOperation, code, message) {
        restOperation.setBody({
            code,
            message
        });
        this.completeRestOperation(restOperation);
        return Promise.resolve();
    }

    getTemplates(restOperation, tmplid) {
        if (tmplid) {
            return this.templateProvider.fetch(tmplid)
                .then((tmpl) => {
                    tmpl.title = tmpl.title || tmplid;
                    restOperation.setHeaders('Content-Type', 'text/json');
                    restOperation.setBody(tmpl);
                    this.completeRestOperation(restOperation);
                }).catch(e => this.genRestResponse(restOperation, 404, e.message));
        }

        return this.templateProvider.list()
            .then((templates) => {
                restOperation.setBody(templates);
                this.completeRestOperation(restOperation);
            });
    }

    onGet(restOperation) {
        const uri = restOperation.getUri();
        const pathElements = uri.path.split('/');
        const [collection, itemid] = [pathElements[3], pathElements[4]];
        try {
            switch (collection) {
            case 'info':
                return this.genRestResponse(restOperation, 200, '');
            case 'templates':
                return this.getTemplates(restOperation, itemid);
            default:
                return this.genRestResponse(restOperation, 404, `unknown endpoint ${uri.path}`);
            }
        } catch (e) {
            return this.genRestResponse(restOperation, 500, e.message);
        }
    }
}

module.exports = TemplateWorker;
