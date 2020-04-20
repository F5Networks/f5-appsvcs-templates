/* jshint ignore: start */

'use strict';

require('core-js');

const fs = require('fs-extra');

const yaml = require('js-yaml');
const extract = require('extract-zip');
const uuid4 = require('uuid').v4;

const fast = require('@f5devcentral/f5-fast-core');
const TeemDevice = require('@f5devcentral/f5-teem').Device;

const FsTemplateProvider = fast.FsTemplateProvider;
const DataStoreTemplateProvider = fast.DataStoreTemplateProvider;
const StorageDataGroup = fast.dataStores.StorageDataGroup;
const httpUtils = fast.httpUtils;
const AS3Driver = fast.AS3Driver;
const TransactionLogger = fast.TransactionLogger;

const pkg = require('../package.json');

const endpointName = 'fast';
const projectName = 'f5-appsvcs-templates';
const mainBlockName = 'F5 Application Services Templates';

const configPath = process.AFL_TW_ROOT || `/var/config/rest/iapps/${projectName}`;
const templatesPath = process.AFL_TW_TS || `${configPath}/templatesets`;
const scratchPath = `${configPath}/scratch`;
const uploadPath = '/var/config/rest/downloads';
const dataGroupPath = `/Common/${projectName}/dataStore`;

// Known good hashes for template sets
const supportedHashes = {
    'bigip-fast-templates': [
        '7dd656c8e965f327b17d35f491a4047ad7c3ac30c4c0e167d81e72d319763a27' //  v1.0
    ],
    examples: [
        'fffa80a94a8ccd2edd3cdea406c68183c1aada851a200268bca5e2aad9f33e66' //  v1.0
    ]
};

class TemplateWorker {
    constructor() {
        this.state = {};

        this.isPublic = true;
        this.isPassThrough = true;
        this.WORKER_URI_PATH = `shared/${endpointName}`;
        this.driver = new AS3Driver('http://localhost:8105/shared/appsvcs');
        this.storage = new StorageDataGroup(dataGroupPath);
        this.templateProvider = new DataStoreTemplateProvider(this.storage, undefined, supportedHashes);
        this.teemDevice = new TeemDevice({
            name: projectName,
            version: pkg.version
        });
        this.transactionLogger = new TransactionLogger(
            (transaction, enterTime) => {
                const [id, text] = transaction.split('@@');
                this.logger.info(`TemplateWorker [${id}]: Entering ${text} at ${enterTime}`);
            },
            (transaction, exitTime, deltaTime) => {
                const [id, text] = transaction.split('@@');
                this.logger.info(`TemplateWorker [${id}]: Exiting ${text} at ${exitTime}`);
                this.logger.fine(`TemplateWorker [${id}]: ${text} took ${deltaTime}ms to complete`);
            }
        );

        this.requestTimes = {};
    }

    hookCompleteRestOp() {
        // Hook completeRestOperation() so we can add additional logging
        this._prevCompleteRestOp = this.completeRestOperation;
        this.completeRestOperation = (restOperation) => {
            this.recordRestResponse(restOperation);
            this._prevCompleteRestOp(restOperation);
        };
    }

    /**
     * Worker Handlers
     */
    onStart(success, error) {
        this.hookCompleteRestOp();

        // Find any template sets on disk (e.g., from the RPM) and add them to
        // the data store. Do not overwrite template sets already in the data store.
        const fsprovider = new FsTemplateProvider(templatesPath);
        let saveState = true;
        this.logger.fine('TemplateWorker: Begin startup');
        return Promise.resolve()
            // Load template sets from disk (i.e., those from the RPM)
            .then(() => this.enterTransaction(0, 'loading template sets from disk'))
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
            .then(() => this.exitTransaction(0, 'loading template sets from disk'))
            // Persist any template set changes
            .then(() => saveState && this.recordTransaction(0, 'persist data store', this.storage.persist()))
            // Automatically add a block
            .then(() => this.enterTransaction(0, 'ensure FAST is in iApps blocks'))
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
            .then(() => this.exitTransaction(0, 'ensure FAST is in iApps blocks'))
            // Done
            .then(() => success())
            // Errors
            .catch((e) => {
                this.logger.severe(`TemplateWorker: Failed to start: ${e.stack}`);
                error();
            });
    }

    onStartCompleted(success, error, _loadedState, errMsg) {
        if (typeof errMsg === 'string' && errMsg !== '') {
            this.logger.error(`TemplateWorker onStart error: ${errMsg}`);
            return error();
        }

        this.generateTeemReportOnStart();
        return success();
    }

    /**
     * TEEM Report Generators
     */
    sendTeemReport(reportName, reportVersion, data) {
        const documentName = `${projectName}: ${reportName}`;
        return this.teemDevice.report(documentName, `${reportVersion}`, {}, data)
            .catch(e => this.logger.error(`TemplateWorker failed to send telemetry data: ${e.stack}`));
    }

    generateTeemReportOnStart() {
        return this.gatherInfo()
            .then(info => this.sendTeemReport('onStart', 1, info))
            .catch(e => this.logger.error(`TemplateWorker failed to send telemetry data: ${e.stack}`));
    }

    generateTeemReportApplication(action, templateName) {
        const report = {
            action,
            templateName
        };
        return Promise.resolve()
            .then(() => this.sendTeemReport('Application Management', 1, report))
            .catch(e => this.logger.error(`TemplateWorker failed to send telemetry data: ${e.stack}`));
    }

    generateTeemReportTemplateSet(action, templateSetName) {
        const report = {
            action,
            templateSetName
        };
        return Promise.resolve()
            .then(() => {
                if (action === 'create') {
                    return Promise.all([
                        this.templateProvider.getNumTemplateSourceTypes(templateSetName),
                        this.templateProvider.getNumSchema(templateSetName)
                    ])
                        .then(([numTemplateTypes, numSchema]) => {
                            report.numTemplateTypes = numTemplateTypes;
                            report.numSchema = numSchema;
                        });
                }
                return Promise.resolve();
            })
            .then(() => this.sendTeemReport('Template Set Management', 1, report))
            .catch(e => this.logger.error(`TemplateWorker failed to send telemetry data: ${e.stack}`));
    }

    generateTeemReportError(restOp) {
        const uri = restOp.getUri();
        const pathElements = uri.path.split('/');
        let endpoint = pathElements.slice(0, 4).join('/');
        if (pathElements[4]) {
            endpoint = `${endpoint}/item`;
        }
        const report = {
            method: restOp.getMethod(),
            endpoint,
            code: restOp.getStatusCode()
        };
        return Promise.resolve()
            .then(() => this.sendTeemReport('Error', 1, report))
            .catch(e => this.logger.error(`TemplateWorker failed to send telemetry data: ${e.stack}`));
    }

    /**
     * Helper functions
     */
    generateRequestId() {
        return uuid4();
    }

    enterTransaction(reqid, text) {
        this.transactionLogger.enter(`${reqid}@@${text}`);
    }

    exitTransaction(reqid, text) {
        this.transactionLogger.exit(`${reqid}@@${text}`);
    }

    recordTransaction(reqid, text, promise) {
        return this.transactionLogger.enterPromise(`${reqid}@@${text}`, promise);
    }

    gatherTemplateSet(tsid) {
        const fsprovider = new FsTemplateProvider(templatesPath);
        return Promise.all([
            this.templateProvider.getSetData(tsid),
            fsprovider.hasSet(tsid)
                .then(result => (result ? fsprovider.getSetData(tsid) : Promise.resolve(undefined)))
        ])
            .then(([tsData, fsTsData]) => {
                tsData.updateAvailable = (
                    fs.existsSync(`${templatesPath}/${tsid}`)
                    && fsTsData && fsTsData.hash !== tsData.hash
                );
                return tsData;
            });
    }

    gatherInfo(requestId) {
        requestId = requestId || 0;
        const info = {
            version: pkg.version,
            as3Info: {},
            installedTemplates: []
        };

        return Promise.resolve()
            .then(() => this.recordTransaction(
                requestId, 'GET to appsvcs/info',
                httpUtils.makeGet('/mgmt/shared/appsvcs/info')
            ))
            .then((as3response) => {
                if (as3response.status < 300) {
                    info.as3Info = as3response.body;
                }
            })
            .then(() => this.enterTransaction(requestId, 'gathering template set data'))
            .then(() => this.templateProvider.listSets())
            .then(setList => Promise.all(setList.map(setName => this.gatherTemplateSet(setName))))
            .then((tmplSets) => {
                info.installedTemplates = tmplSets;
            })
            .then(() => this.exitTransaction(requestId, 'gathering template set data'))
            .then(() => info);
    }

    hydrateSchema(schema, requestId) {
        const enumFromBigipProps = Object.entries(schema.properties)
            .reduce((acc, curr) => {
                const [key, value] = curr;
                if (value.enumFromBigip) {
                    acc[key] = value;
                }
                return acc;
            }, {});
        const propNames = Object.keys(enumFromBigipProps);
        this.logger.fine(
            `TemplateWorker [${requestId}]: Hydrating properties: ${JSON.stringify(propNames, null, 2)}`
        );

        return Promise.resolve()
            .then(() => Promise.all(Object.values(enumFromBigipProps).map((prop) => {
                const endPoint = `/mgmt/tm/${prop.enumFromBigip}?$select=fullPath`;
                return Promise.resolve()
                    .then(() => this.recordTransaction(
                        requestId, `fetching data from ${endPoint}`,
                        httpUtils.makeGet(endPoint)
                    ))
                    .then((response) => {
                        if (response.status !== 200) {
                            return Promise.reject(new Error(
                                `failed GET to ${endPoint}:\n${JSON.stringify(response, null, 2)}`
                            ));
                        }
                        return Promise.resolve(response.body.items.map(x => x.fullPath));
                    })
                    .then((items) => {
                        prop.enum = items;
                        delete prop.enumFromBigip;
                    });
            })))
            .then(() => schema);
    }

    /**
     * HTTP/REST handlers
     */
    recordRestRequest(restOp) {
        this.requestTimes[restOp.requestId] = new Date();
        this.logger.fine(
            `TemplateWorker [${restOp.requestId}]: received request method=${restOp.getMethod()}; path=${restOp.getUri().path}`
        );
    }

    recordRestResponse(restOp) {
        const minOp = {
            method: restOp.getMethod(),
            path: restOp.getUri().path,
            status: restOp.getStatusCode()
        };
        const dt = Date.now() - this.requestTimes[restOp.requestId].getTime();
        const msg = `TemplateWorker [${restOp.requestId}]: sending response after ${dt}ms\n${JSON.stringify(minOp, null, 2)}`;
        delete this.requestTimes[restOp.requestId];
        if (minOp.status >= 400) {
            this.logger.error(msg);
        } else {
            this.logger.fine(msg);
        }
    }

    genRestResponse(restOperation, code, message) {
        restOperation.setStatusCode(code);
        restOperation.setBody({
            code,
            message
        });
        this.completeRestOperation(restOperation);
        if (code >= 400) {
            this.generateTeemReportError(restOperation);
        }
        return Promise.resolve();
    }

    getInfo(restOperation) {
        return Promise.resolve()
            .then(() => this.gatherInfo(restOperation.requestId))
            .then((info) => {
                restOperation.setBody(info);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.stack));
    }

    getTemplates(restOperation, tmplid) {
        const reqid = restOperation.requestId;
        if (tmplid) {
            const uri = restOperation.getUri();
            const pathElements = uri.path.split('/');
            tmplid = pathElements.slice(4, 6).join('/');

            return Promise.resolve()
                .then(() => this.recordTransaction(
                    reqid, 'fetching template',
                    this.templateProvider.fetch(tmplid)
                ))
                .then((tmpl) => {
                    tmpl.title = tmpl.title || tmplid;
                    return this.hydrateSchema(tmpl._viewSchema, reqid)
                        .then(() => {
                            restOperation.setBody(tmpl);
                            this.completeRestOperation(restOperation);
                        });
                }).catch(e => this.genRestResponse(restOperation, 404, e.stack));
        }

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid, 'fetching template list',
                this.templateProvider.list()
            ))
            .then((templates) => {
                restOperation.setBody(templates);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.stack));
    }

    getApplications(restOperation, appid) {
        const reqid = restOperation.requestId;
        if (appid) {
            const uri = restOperation.getUri();
            const pathElements = uri.path.split('/');
            const tenant = pathElements[4];
            const app = pathElements[5];
            return Promise.resolve()
                .then(() => this.recordTransaction(
                    reqid, 'GET request to appsvcs/declare',
                    httpUtils.makeGet('/mgmt/shared/appsvcs/declare')
                ))
                .then((resp) => {
                    const decl = resp.body;
                    restOperation.setBody(decl[tenant][app]);
                    this.completeRestOperation(restOperation);
                })
                .catch(e => this.genRestResponse(restOperation, 404, e.stack));
        }

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid, 'gathering a list of applications from the driver',
                this.driver.listApplications()
            ))
            .then((appsList) => {
                restOperation.setBody(appsList);
                this.completeRestOperation(restOperation);
            });
    }

    getTasks(restOperation, taskid) {
        const reqid = restOperation.requestId;
        if (taskid) {
            return Promise.resolve()
                .then(() => this.recordTransaction(
                    reqid, 'gathering a list of tasks from the driver',
                    this.driver.getTasks()
                ))
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

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid, 'gathering a list of tasks from the driver',
                this.driver.getTasks()
            ))
            .then((tasksList) => {
                restOperation.setBody(tasksList);
                this.completeRestOperation(restOperation);
            })
            .catch(e => this.genRestResponse(restOperation, 500, e.stack));
    }

    getTemplateSets(restOperation, tsid) {
        const reqid = restOperation.requestId;
        if (tsid) {
            return Promise.resolve()
                .then(() => this.recordTransaction(
                    reqid, 'gathering a template set',
                    this.gatherTemplateSet(tsid)
                ))
                .then((tmplSet) => {
                    restOperation.setBody(tmplSet);
                    this.completeRestOperation(restOperation);
                })
                .catch((e) => {
                    if (e.message.match(/No templates found/)) {
                        return this.genRestResponse(restOperation, 404, e.message);
                    }
                    return this.genRestResponse(restOperation, 500, e.stack);
                });
        }

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid, 'gathering a list of template sets',
                this.templateProvider.listSets()
            ))
            .then(setList => Promise.all(setList.map(x => this.gatherTemplateSet(x))))
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

        restOperation.requestId = this.generateRequestId();

        this.recordRestRequest(restOperation);

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
        const reqid = restOperation.requestId;
        const lastModified = new Date().toISOString();
        if (!Array.isArray(data)) {
            data = [data];
        }

        // this.logger.info(`postApplications() received:\n${JSON.stringify(data, null, 2)}`);

        return Promise.resolve()
            .then(() => {
                const appsData = [];
                let promiseChain = Promise.resolve();
                data.forEach((x) => {
                    promiseChain = promiseChain
                        .then(() => {
                            this.generateTeemReportApplication('modify', x.name);
                        })
                        .then(() => this.recordTransaction(
                            reqid, `loading template (${x.name})`,
                            this.templateProvider.fetch(x.name)
                        ))
                        .catch(e => Promise.reject(
                            this.genRestResponse(
                                restOperation,
                                404,
                                `unable to load template: ${x.name}\n${e.stack}`
                            )
                        ))
                        .then(tmpl => this.recordTransaction(
                            reqid, `rendering template (${x.name})`,
                            Promise.resolve(yaml.safeLoad(tmpl.render(x.parameters)))
                        ))
                        .catch((e) => {
                            if (restOperation.status >= 400) {
                                return Promise.reject();
                            }
                            return Promise.reject(this.genRestResponse(
                                restOperation,
                                400,
                                `failed to render template: ${x.name}\n${e.stack}`
                            ));
                        })
                        .then((decl) => {
                            appsData.push({
                                appDef: decl,
                                metaData: {
                                    template: x.name,
                                    view: x.parameters,
                                    lastModified
                                }
                            });
                        });
                });
                return promiseChain.then(() => appsData);
            })
            .then(appsData => this.recordTransaction(
                reqid, 'requesting new application(s) from the driver',
                this.driver.createApplications(appsData)
            ))
            .catch((e) => {
                if (restOperation >= 400) {
                    return Promise.reject();
                }
                return Promise.reject(this.genRestResponse(
                    restOperation,
                    400,
                    `error generating AS3 declaration\n${e.stack}`
                ));
            })
            .then((response) => {
                if (response.status >= 300) {
                    return this.genRestResponse(restOperation, response.status, response.body);
                }
                return this.genRestResponse(restOperation, response.status, data.map(
                    x => ({
                        id: response.body.id,
                        name: x.name,
                        parameters: x.parameters
                    })
                ));
            })
            .catch((e) => {
                if (restOperation.status < 400) {
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
        const reqid = restOperation.requestId;
        const setpath = `${uploadPath}/${tsid}.zip`;
        const scratch = `${scratchPath}/${tsid}`;
        const onDiskPath = `${templatesPath}/${tsid}`;

        if (!data.name) {
            return this.genRestResponse(restOperation, 400, `invalid template set name supplied: ${tsid}`);
        }

        if (!fs.existsSync(setpath) && !fs.existsSync(onDiskPath)) {
            return this.genRestResponse(restOperation, 404, `${setpath} does not exist`);
        }

        // Setup a scratch location we can use while validating the template set
        this.enterTransaction(reqid, 'prepare scratch space');
        fs.removeSync(scratch);
        fs.mkdirsSync(scratch);
        this.exitTransaction(reqid, 'prepare scratch space');

        return Promise.resolve()
            .then(() => this.enterTransaction(reqid, 'extract template set'))
            .then(() => {
                if (fs.existsSync(onDiskPath)) {
                    return fs.copy(onDiskPath, scratch);
                }

                return new Promise((resolve, reject) => {
                    extract(setpath, { dir: scratch }, (err) => {
                        if (err) return reject(err);
                        return resolve();
                    });
                });
            })
            .then(() => this.exitTransaction(reqid, 'extract template set'))
            .then(() => this.recordTransaction(
                reqid, 'validate template set',
                this._validateTemplateSet(scratchPath)
            ))
            .then(() => this.enterTransaction(reqid, 'write new template set to data store'))
            .then(() => this.templateProvider.invalidateCache())
            .then(() => DataStoreTemplateProvider.fromFs(this.storage, scratchPath, [tsid]))
            .then(() => {
                this.generateTeemReportTemplateSet('create', tsid);
            })
            .then(() => this.storage.persist())
            .then(() => this.storage.keys()) // Regenerate the cache, might as well take the hit here
            .then(() => this.exitTransaction(reqid, 'write new template set to data store'))
            .then(() => this.genRestResponse(restOperation, 200, ''))
            .catch(e => this.genRestResponse(restOperation, 500, e.stack))
            .finally(() => fs.removeSync(scratch));
    }

    onPost(restOperation) {
        const body = restOperation.getBody();
        const uri = restOperation.getUri();
        const pathElements = uri.path.split('/');
        const collection = pathElements[3];

        restOperation.requestId = this.generateRequestId();

        this.recordRestRequest(restOperation);

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
            return this.genRestResponse(restOperation, 500, e.message);
        }
    }

    deleteApplications(restOperation, appid) {
        const reqid = restOperation.requestId;
        const uri = restOperation.getUri();
        const pathElements = uri.path.split('/');
        const tenant = pathElements[4];
        const app = pathElements[5];

        if (!appid) {
            return this.genRestResponse(restOperation, 405, 'DELETE is only supported for individual applications');
        }

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid, 'requesting driver to delete an application',
                this.driver.deleteApplication(tenant, app)
            ))
            .then((result) => {
                restOperation.setHeaders('Content-Type', 'text/json');
                restOperation.setBody(result);
                this.completeRestOperation(restOperation);
            })
            .then(() => {
                this.generateTeemReportApplication('delete', '');
            })
            .catch(e => this.genRestResponse(restOperation, 404, e.stack));
    }

    deleteTemplateSets(restOperation, tsid) {
        const reqid = restOperation.requestId;
        if (!tsid) {
            return this.genRestResponse(restOperation, 405, 'DELETE is only supported for individual template sets');
        }

        return Promise.resolve()
            .then(() => this.recordTransaction(
                reqid, 'deleting a template set from the data store',
                this.templateProvider.removeSet(tsid)
            ))
            .then(() => {
                this.generateTeemReportTemplateSet('delete', tsid);
            })
            .then(() => this.recordTransaction(
                reqid, 'persisting the data store',
                this.storage.persist()
                    .then(() => this.storage.keys()) // Regenerate the cache, might as well take the hit here
            ))
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

        restOperation.requestId = this.generateRequestId();

        this.recordRestRequest(restOperation);

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
            return this.genRestResponse(restOperation, 500, e.stack);
        }
    }
}

module.exports = TemplateWorker;
