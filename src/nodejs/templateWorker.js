/*
 * Copyright 2019. F5 Networks, Inc. See End User License Agreement ("EULA") for
 * license terms. Notwithstanding anything to the contrary in the EULA, Licensee
 * may copy and modify this software product for its internal business purposes.
 * Further, Licensee may upload, publish and distribute the modified version of
 * the software product on devcentral.f5.com.
 */


'use strict';

const fs = require('fs');
const http = require('http');

class TemplateWorker {
    constructor() {
        this.isPublic = true;
        this.isPassThrough = true;
        this.projectName = 'mystique';
        this.WORKER_URI_PATH = `shared/${this.projectName}`;
        this.schemasDir = `/var/config/rest/iapps/${this.projectName}/schemas`;
        this.templatesDir = `/var/config/rest/iapps/${this.projectName}/templates`;
        this.presentationDir = `/var/config/rest/iapps/${this.projectName}/presentation`;
        this.httpOpts = {
            host: 'localhost',
            port: 8100,
            headers: {
                'Authorization': 'Basic ' + Buffer.from('admin:').toString('base64'),
                'Content-Type': 'application/json'
            }
        };
    }

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
        let opts = this.httpOpts;
        opts.path = path;
        return this.httpRequest(opts);
    }

    httpPost(path, payload) {
        let opts = this.httpOpts;
        opts.path = path;
        opts.method = 'POST';
        return this.httpRequest(opts, payload);
    }

    httpPatch(path, payload) {
        let opts = this.httpOpts;
        opts.path = path;
        opts.method = 'PATCH';
        return this.httpRequest(opts, payload);
    }

    templateGet(fileName) {
        let tmpl;
        let fields = [];

        try {
            tmpl = fs.readFileSync(`${this.templatesDir}/${fileName}`, 'utf8');
        } catch(err) {
            return `Unable to read file ${this.templatesDir}/${fileName}. ${err}`;
        }
        // strip the file type suffix
        let name = fileName.replace(/\.[^.]*?$/, '');
        // parse remark from xml-style .tmpl file
        let remark = tmpl.replace(/[\s\S]*<description>([\s\S]*?)<\/description>[\s\S]*/m, '$1');
        // parse remark from mustache-style .mst file
        if (remark === tmpl) remark = tmpl.match(/{{!.*?}}/);
        // parse the declaration from the xml-style .tmpl file
        let decl = tmpl.replace(/[\s\S]*<declaration>([\s\S]*?)<\/declaration>[\s\S]*/m, '$1')
        // extract the mustache template fields from declaration
        decl.match(/{{.*?}}/g).map(x => x.slice(2, -2).split(':'))
            .forEach(x => {
                fields.push({
                    name: x[0],
                    type: x[1],
                    value: x[2]
                });
            });
        return { name, remark, fields };
    }

    // LX block status controls the ball color shown in the BIG-IP UI.
    // When at least one mustache app is deployed, set state to BOUND (green).
    // When all are deleted, set state to UNBOUND (gray).
    // TODO: resolve(block.id), refactor as (state, blockName) and if blockName is undefined, use stored blockId.
    setLxBlockStatus(blockName, state) {
        const blockData = {
            'name': blockName,
            'state': state || 'UNBOUND',
            'configurationProcessorReference': {
                'link': 'https://localhost/mgmt/shared/iapp/processors/noop'
            },
            'presentationHtmlReference': {
                'link': 'https://localhost/iapps/mystique/index.html'
            }
        };

        return this.httpGet('/shared/iapp/blocks')
            .then((res) => {
                if (res.status == 200) {
                    let body = JSON.parse(res.body);
                    let noBlockFound = true;
                    body.items.forEach(block => {
                        if (block.name === blockName) {
                            noBlockFound = false;
                            if (state !== undefined && state !== block.state) {
                                this.httpPatch(`/shared/iapp/blocks/${block.id}`, { 'state': state });
                            }
                        }
                    });
                    if (noBlockFound) {
                        this.httpPost('/shared/iapp/blocks', blockData);
                    }
                }
            });
    }

    onStartCompleted(success, failure) {
        this.setLxBlockStatus(this.projectName)
            .then(() => {
                success();
            })
            .catch((err) => {
                failure(err);
            });
    }

    onGet(restOperation) {
        const path = restOperation.getUri().path.split('/');
        const resourceType = path[3];
        const resourceName = path[4] || null;
        const resourceName2 = path[5] || null;
        let promises = [];
        let body = [];

        switch(resourceType) {
        case 'app-names':
            promises.push(this.httpGet('/mgmt/shared/appsvcs/declare')
                .then((res) => {
                    try {
                        let decl = JSON.parse(res.body);
                        // ignore AS3 classes that do not contain apps
                        let tenants = Object.keys(decl)
                            .filter(x => decl[x].class === 'Tenant');
                        tenants.forEach(tenant => {
                            let apps = Object.keys(decl[tenant])
                                .filter(x => decl[tenant][x].class === 'Application'
                                    && decl[tenant][x].constants !== undefined
                                    && decl[tenant][x].constants.template !== undefined);
                            apps.forEach(app => {
                                let ui;
                                let tmpl = decl[tenant][app].constants.template;
                                // check if a custom ui is present for this template
                                try {
                                    fs.openSync(`${this.presentationDir}/${tmpl}/index.html`, 'r');
                                    ui = tmpl;
                                } catch (err) {
                                    ui = 'f5.default';
                                }
                                body.push({
                                    app,
                                    tenant,
                                    template: tmpl,
                                    remark: decl[tenant][app].remark || '',
                                    ui
                                });
                            });
                        });
                    } catch (err) {
                        body = `Unable to read AS3 declaration. ${err}`;
                    }
                })
            );
            break;
        case 'template-names':
            fs.readdirSync(this.templatesDir).forEach((template) => {
                // read the file
                let tmpl = fs.readFileSync(`${this.templatesDir}/${template}`, 'utf8');
                // parse remark from xml-style template.tmpl
                let remark = tmpl.replace(/[\s\S]*<description>([\s\S]*?)<\/description>[\s\S]*/m, '$1');
                // parse remark from mustache-style template.mst
                if (remark === tmpl) remark = tmpl.match(/{{!.*?}}/);
                // strip the file type suffix
                let name = template.replace(/\.[^.]*?$/, '');
                // check if a custom ui is present for this template
                let ui;
                try {
                    fs.openSync(`${this.presentationDir}/${name}/index.html`, 'r');
                    ui = name;
                } catch (err) {
                    ui = 'f5.default';
                }
                body.push({
                    template,
                    remark,
                    ui
                });
            });
            break;
        case 'app':
            promises.push(this.httpGet('/mgmt/shared/appsvcs/declare')
                .then((res) => {
                    try {
                        let decl = JSON.parse(res.body);
                        let appDef = decl[resourceName][resourceName2].constants;
                        delete appDef.class;
                        let tmpl = this.templateGet(appDef.template);
                        (tmpl.fields || []).forEach(item => {
                            item.value = appDef.fields[item.name] || item.value;
                        });
                        body = {
                            name: resourceName2,
                            tenant: resourceName,
                            template: appDef.template,
                            remark: appDef.remark || '',
                            fields: tmpl.fields || []
                        };
                    } catch (err) {
                        body = `Unable to read AS3 declaration. ${err}`;
                    }
                })
            );
            break;
        case 'template':
            body = this.templateGet(resourceName);
            break;
        default:
            body = `/${resourceType} not recognized`;
            break;
        }
        Promise.all(promises).then(() => {
            restOperation.setBody(body);
            restOperation.setHeaders('Content-Type', 'application/json');
            this.completeRestOperation(restOperation);
        });
    }
}

module.exports = TemplateWorker;
