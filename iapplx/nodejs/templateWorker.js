'use strict';

const fs = require('fs');

const yaml = require('js-yaml');
const extract = require('extract-zip');

const fast = require('@f5devcentral/fast');

const FsSchemaProvider = fast.FsSchemaProvider;
const FsTemplateProvider = fast.FsTemplateProvider;
const httpUtils = fast.httpUtils;
const AS3Driver = fast.AS3Driver;

const pkg = require('../package.json');

const endpointName = 'fast';
const projectName = 'f5-appsvcs-templates';
const mainBlockName = 'F5 Application Services Templates';

const configPath = process.AFL_TW_ROOT || `/var/config/rest/iapps/${projectName}`;
const templatesPath = process.AFL_TW_TS || `${configPath}/templatesets`;
const scratchPath = `${configPath}/scratch`;
const uploadPath = '/var/config/rest/downloads';

class TemplateWorker {
    constructor() {
        this.state = {};

        this.isPublic = true;
        this.isPassThrough = true;
        this.WORKER_URI_PATH = `shared/${endpointName}`;
        this.schemaProvider = new FsSchemaProvider(`${templatesPath}/f5-debug`);
        this.templateProvider = new FsTemplateProvider(templatesPath, this.schemaProvider);
        this.driver = new AS3Driver('http://localhost:8105/shared/appsvcs');
    }

    /**
     * Worker Handlers
     */
    onStartCompleted(success, error, state, errMsg) {
        if (errMsg) {
            this.logger.severe(`TemplateWorker onStartCompleted error: something went wrong ${errMsg}`);
            error();
        }
        this.setLxBlockStatus(mainBlockName)
            .then(() => {
                this.logger.fine(`TemplateWorker state loaded: ${JSON.stringify(state)}`);
                success();
            })
            .catch((err) => {
                error(err);
            });
    }

    // LX block status controls the ball color shown in the BIG-IP UI.
    // When at least one FAST app is deployed, set state to BOUND (green).
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

        return httpUtils.makeGet('/shared/iapp/blocks')
            .then((res) => {
                if (res.status === 200) {
                    const body = res.body;
                    let noBlockFound = true;
                    body.items.forEach((block) => {
                        if (block.name === blockName) {
                            noBlockFound = false;
                            if (state !== undefined && state !== block.state) {
                                httpUtils.makePatch(`/shared/iapp/blocks/${block.id}`, {
                                    state,
                                    presentationHtmlReference: blockData.presentationHtmlReference
                                });
                            }
                        }
                    });
                    if (noBlockFound) {
                        httpUtils.makePost('/shared/iapp/blocks', blockData);
                    }
                }
            });
    }

    /**
     * HTTP/REST handlers
     */
    genRestResponse(restOperation, code, message) {
        restOperation.setStatusCode(code);
        restOperation.setBody({
            code,
            message
        });
        this.completeRestOperation(restOperation);
        return Promise.resolve();
    }

    getInfo(restOperation) {
        const info = {
            version: pkg.version,
            as3Info: {}
        };

        return httpUtils.makeGet('/mgmt/shared/appsvcs/info')
            .then((response) => {
                if (response.status < 300) {
                    info.as3Info = response.body;
                }
                restOperation.setBody(info);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(500, e.stack));
    }

    getTemplates(restOperation, tmplid) {
        if (tmplid) {
            const uri = restOperation.getUri();
            const pathElements = uri.path.split('/');
            tmplid = pathElements.slice(4, 6).join('/');

            return this.templateProvider.fetch(tmplid)
                .then((tmpl) => {
                    tmpl.title = tmpl.title || tmplid;
                    restOperation.setBody(tmpl);
                    this.completeRestOperation(restOperation);
                }).catch(e => this.genRestResponse(restOperation, 404, e.stack));
        }

        return this.templateProvider.list()
            .then((templates) => {
                restOperation.setBody(templates);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.stack));
    }

    getApplications(restOperation, appid) {
        if (appid) {
            const uri = restOperation.getUri();
            const pathElements = uri.path.split('/');
            const tenant = pathElements[4];
            const app = pathElements[5];
            return httpUtils.makeGet('/mgmt/shared/appsvcs/declare')
                .then((resp) => {
                    const decl = resp.body;
                    restOperation.setBody(decl[tenant][app]);
                    this.completeRestOperation(restOperation);
                })
                .catch(e => this.genRestResponse(restOperation, 404, e.stack));
        }

        return this.driver.listApplications()
            .then((appsList) => {
                restOperation.setBody(appsList);
                this.completeRestOperation(restOperation);
            });
    }

    getTasks(restOperation, taskid) {
        if (taskid) {
            return this.driver.getTasks()
                .then(taskList => taskList.filter(x => x.id === taskid))
                .then((taskList) => {
                    if (taskList.length === 0) {
                        return this.genRestResponse(restOperation, 404, `unknown task ID: ${taskid}`);
                    }
                    restOperation.setBody(taskList[0]);
                    this.completeRestOperation(restOperation);
                    return Promise.resolve();
                })
                .catch(e => this.genRestResponse(restOperation, 500, e.stack));
        }

        return this.driver.getTasks()
            .then((tasksList) => {
                restOperation.setBody(tasksList);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.stack));
    }

    getTemplateSets(restOperation, tsid) {
        if (tsid) {
            return this.templateProvider.list()
                .then((templates) => {
                    const filteredList = templates.filter(x => x.startsWith(`${tsid}/`));
                    if (filteredList.length === 0) {
                        return this.genRestResponse(restOperation, 404, `No templates found for template set ${tsid}`);
                    }
                    restOperation.setBody(filteredList);
                    this.completeRestOperation(restOperation);
                    return Promise.resolve();
                })
                .catch(e => this.genRestResponse(restOperation, 500, e.stack));
        }

        return this.templateProvider.list()
            .then(templates => Array.from(templates.reduce((acc, curr) => acc.add(curr.split('/')[0]), new Set())))
            .then((setList) => {
                restOperation.setBody(setList);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.stack));
    }

    onGet(restOperation) {
        const uri = restOperation.getUri();
        const pathElements = uri.path.split('/');
        const collection = pathElements[3];
        const itemid = pathElements[4];
        try {
            switch (collection) {
            case 'info':
                return this.getInfo(restOperation);
            case 'templates':
                return this.getTemplates(restOperation, itemid);
            case 'applications':
                return this.getApplications(restOperation, itemid);
            case 'tasks':
                return this.getTasks(restOperation, itemid);
            case 'templatesets':
                return this.getTemplateSets(restOperation, itemid);
            default:
                return this.genRestResponse(restOperation, 404, `unknown endpoint ${uri.path}`);
            }
        } catch (e) {
            return this.genRestResponse(restOperation, 500, e.statck);
        }
    }

    postApplications(restOperation, data) {
        const tmplid = data.name;
        const tmplView = data.parameters;
        const currentTime = new Date();
        const metadata = {
            template: tmplid,
            view: tmplView,
            lastModified: currentTime.toISOString()
        };
        return this.templateProvider.fetch(tmplid)
            .then(tmpl => yaml.safeLoad(tmpl.render(tmplView)))
            .then(declaration => this.driver.createApplication(declaration, metadata))
            .catch(e => Promise.reject(
                this.genRestResponse(restOperation, 400, `unable to load template: ${tmplid}\n${e.stack}`)
            ))
            .then((response) => {
                if (response.status >= 300) {
                    return this.genRestResponse(restOperation, response.status, response.body);
                }
                return this.genRestResponse(restOperation, response.status, {
                    id: response.body.id,
                    name: tmplid,
                    parameters: tmplView
                });
            })
            .catch((e) => {
                if (restOperation.status !== 400) {
                    this.genRestResponse(restOperation, 500, e.stack);
                }
            });
    }

    _validateTemplateSet(tspath) {
        const tmplProvider = new FsTemplateProvider(scratchPath, new FsSchemaProvider(tspath));
        return tmplProvider.list()
            .then(templateList => Promise.all(templateList.map(tmpl => tmplProvider.fetch(tmpl))));
    }

    postTemplateSets(restOperation, data) {
        const tsid = data.name;
        const setpath = `${uploadPath}/${tsid}.zip`;
        const targetpath = `${templatesPath}/${tsid}`;
        const scratch = `${scratchPath}/${tsid}`;

        if (!data.name) {
            return this.genRestResponse(restOperation, 400, `invalid template set name supplied: ${tsid}`);
        }

        if (!fs.existsSync(setpath)) {
            return this.genRestResponse(restOperation, 404, `${setpath} does not exist`);
        }

        // Setup a scratch location we can use while validating the template set
        if (fs.existsSync(scratchPath)) {
            fs.rmdirSync(scratchPath);
        }
        fs.mkdirSync(scratchPath);
        fs.mkdirSync(scratch);

        return new Promise((resolve, reject) => {
            extract(setpath, { dir: scratch }, (err) => {
                if (err) return reject(err);
                return resolve();
            });
        })
            .then(() => this._validateTemplateSet(scratch))
            .then(() => {
                if (fs.existsSync(targetpath)) {
                    fs.rmdirSync(targetpath);
                }
                fs.renameSync(scratch, targetpath);
            })
            .then(() => this.genRestResponse(restOperation, 200, ''))
            .catch(e => this.genRestResponse(restOperation, 500, e.stack))
            .finally(() => {
                if (fs.existsSync(scratch)) {
                    fs.rmdirSync(scratch);
                }
            });
    }

    onPost(restOperation) {
        const body = restOperation.getBody();
        const uri = restOperation.getUri();
        const pathElements = uri.path.split('/');
        const collection = pathElements[3];

        try {
            switch (collection) {
            case 'applications':
                return this.postApplications(restOperation, body);
            case 'templatesets':
                return this.postTemplateSets(restOperation, body);
            default:
                return this.genRestResponse(restOperation, 404, `unknown endpoint ${uri.path}`);
            }
        } catch (e) {
            return this.genRestResponse(restOperation, 500, `${e.message}\n${restOperation.getBody()}`);
        }
    }

    deleteApplications(restOperation, appid) {
        const uri = restOperation.getUri();
        const pathElements = uri.path.split('/');
        const tenant = pathElements[4];
        const app = pathElements[5];

        if (!appid) {
            return this.genRestResponse(restOperation, 405, 'DELETE is only supported for individual applications');
        }

        return this.driver.deleteApplication(tenant, app)
            .then((result) => {
                restOperation.setHeaders('Content-Type', 'text/json');
                restOperation.setBody(result);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 404, e.stack));
    }

    deleteTemplateSets(restOperation, tsid) {
        const tspath = `${templatesPath}/${tsid}`;
        if (!fs.existsSync(tspath)) {
            return this.genRestResponse(restOperation, 404, `template set not found: ${tsid}`);
        }

        try {
            fs.rmdirSync(tspath);
        } catch (e) {
            return this.genRestResponse(restOperation, 500, e.stack);
        }

        return this.genRestResponse(restOperation, 200, '');
    }

    onDelete(restOperation) {
        const uri = restOperation.getUri();
        const pathElements = uri.path.split('/');
        const collection = pathElements[3];
        const itemid = pathElements[4];

        try {
            switch (collection) {
            case 'applications':
                return this.deleteApplications(restOperation, itemid);
            case 'templatesets':
                return this.deleteTemplateSets(restOperation, itemid);
            default:
                return this.genRestResponse(restOperation, 404, `unknown endpoint ${uri.path}`);
            }
        } catch (e) {
            return this.genRestResponse(restOperation, 500, `${e.message}\n${restOperation.getBody()}`);
        }
    }
}

module.exports = TemplateWorker;
