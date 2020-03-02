'use strict';

require('core-js');

const fs = require('fs-extra');

const yaml = require('js-yaml');
const extract = require('extract-zip');

const fast = require('@f5devcentral/fast');

const FsTemplateProvider = fast.FsTemplateProvider;
const DataStoreTemplateProvider = fast.DataStoreTemplateProvider;
const StorageDataGroup = fast.dataStores.StorageDataGroup;
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
const dataGroupPath = `/Common/${projectName}/dataStore`;

class TemplateWorker {
    constructor() {
        this.state = {};

        this.isPublic = true;
        this.isPassThrough = true;
        this.WORKER_URI_PATH = `shared/${endpointName}`;
        this.driver = new AS3Driver('http://localhost:8105/shared/appsvcs');
        this.storage = new StorageDataGroup(dataGroupPath);
        this.templateProvider = new DataStoreTemplateProvider(this.storage);
    }

    /**
     * Worker Handlers
     */
    onStart(success, error) {
        // Find any template sets on disk (e.g., from the RPM) and add them to
        // the data store. Do not overwrite template sets already in the data store.
        const fsprovider = new FsTemplateProvider(templatesPath);
        let saveState = true;
        this.logger.fine('TemplateWorker: Begin startup');
        return Promise.resolve()
            // Load template sets from disk (i.e., those from the RPM)
            .then(() => Promise.all([fsprovider.listSets(), this.templateProvider.listSets()]))
            .then(([fsSets, knownSets]) => {
                const sets = fsSets.filter(setName => !knownSets.includes(setName));
                this.logger.info(
                    `TemplateWorker: Loading template sets from disk: ${JSON.stringify(sets)} (skipping: ${JSON.stringify(knownSets)})`
                );
                if (sets.length === 0) {
                    // Nothing to do
                    saveState = false;
                    return Promise.resolve();
                }
                this.templateProvider.invalidateCache();
                return DataStoreTemplateProvider.fromFs(this.storage, templatesPath, sets);
            })
            // Persist any template set changes
            .then(() => saveState && this.storage.persist())
            // Automatically add a block
            .then(() => httpUtils.makeGet('/shared/iapp/blocks'))
            .then((results) => {
                if (results.status !== 200) {
                    return Promise.reject(new Error(`failed to get blocks: ${JSON.stringify(results.body, null, 2)}`));
                }
                const matchingBlocks = results.body.items.filter(x => x.name === mainBlockName);
                const blockData = {
                    name: mainBlockName,
                    state: 'BOUND',
                    configurationProcessorReference: {
                        link: 'https://localhost/mgmt/shared/iapp/processors/noop'
                    },
                    presentationHtmlReference: {
                        link: `https://localhost/iapps/${projectName}/index.html`
                    }
                };

                if (matchingBlocks.length === 0) {
                    // No existing block, make a new one
                    return httpUtils.makePost('/shared/iapp/blocks', blockData);
                }

                // Found a block, do nothing
                return Promise.resolve({ status: 200 });
            })
            .then((results) => {
                if (results.status !== 200) {
                    return Promise.reject(
                        new Error(`failed to set block state: ${JSON.stringify(results.body, null, 2)}`)
                    );
                }
                return Promise.resolve();
            })
            // Done
            .then(() => success())
            // Errors
            .catch((e) => {
                this.logger.severe(`TemplateWorker: Failed to start: ${e.stack}`);
                error();
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
            as3Info: {},
            installedTemplates: []
        };

        return Promise.resolve()
            .then(() => Promise.all([
                httpUtils.makeGet('/mgmt/shared/appsvcs/info'),
                this.templateProvider.list()
            ]))
            .then(([as3response, tmplList]) => {
                if (as3response.status < 300) {
                    info.as3Info = as3response.body;
                }
                info.installedTemplates = tmplList;
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

        return this.templateProvider.listSets()
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
        const tmplProvider = new FsTemplateProvider(tspath);
        return tmplProvider.list()
            .then(templateList => Promise.all(templateList.map(tmpl => tmplProvider.fetch(tmpl))));
    }

    postTemplateSets(restOperation, data) {
        const tsid = data.name;
        const setpath = `${uploadPath}/${tsid}.zip`;
        const scratch = `${scratchPath}/${tsid}`;

        if (!data.name) {
            return this.genRestResponse(restOperation, 400, `invalid template set name supplied: ${tsid}`);
        }

        if (!fs.existsSync(setpath)) {
            return this.genRestResponse(restOperation, 404, `${setpath} does not exist`);
        }

        // Setup a scratch location we can use while validating the template set
        fs.removeSync(scratch);
        fs.mkdirsSync(scratch);

        return new Promise((resolve, reject) => {
            extract(setpath, { dir: scratch }, (err) => {
                if (err) return reject(err);
                return resolve();
            });
        })
            .then(() => this._validateTemplateSet(scratchPath))
            .then(() => this.templateProvider.invalidateCache())
            .then(() => DataStoreTemplateProvider.fromFs(this.storage, scratchPath, [tsid]))
            .then(() => this.storage.persist())
            .then(() => this.storage.keys()) // Regenerate the cache, might as well take the hit here
            .then(() => this.genRestResponse(restOperation, 200, ''))
            .catch(e => this.genRestResponse(restOperation, 500, e.stack))
            .finally(() => fs.removeSync(scratch));
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
        if (!tsid) {
            return this.genRestResponse(restOperation, 405, 'DELETE is only supported for individual template sets');
        }

        return this.templateProvider.removeSet(tsid)
            .then(() => this.storage.persist())
            .then(() => this.storage.keys()) // Regenerate the cache, might as well take the hit here
            .then(() => this.genRestResponse(restOperation, 200, 'success'))
            .catch((e) => {
                if (e.message.match(/failed to find template set/)) {
                    return this.genRestResponse(restOperation, 404, e.message);
                }
                return this.genRestResponse(restOperation, 500, e.stack);
            });
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
