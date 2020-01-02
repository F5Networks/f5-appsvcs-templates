'use strict';

const mystique = require('mystique');

const http = require('http');

const ATRequest = mystique.at_util.ATRequest;

const FsTemplateProvider = mystique.template_provider.FsTemplateProvider;

const HtmlTemplate = mystique.html_engine.HtmlTemplate;

const configPath = process.AFL_TW_ROOT || '/var/config/rest/iapps/mystique';

function TemplateWorker() {
    this.state = {};
    this.provider = new FsTemplateProvider(`${configPath}/templates`, `${configPath}/schemas`);
}

TemplateWorker.prototype.WORKER_URI_PATH = 'shared/mystique';
TemplateWorker.prototype.isPublic = true;
TemplateWorker.prototype.isPersisted = true;
TemplateWorker.prototype.isPassThrough = true;
TemplateWorker.prototype.projectName = 'mystique';

TemplateWorker.prototype.httpOpts = {
    host: 'localhost',
    port: 8100,
    headers: {
        Authorization: `Basic ${Buffer.from('admin:').toString('base64')}`,
        'Content-Type': 'application/json'
    }
};

TemplateWorker.prototype.onStart = function onStart(success, error) {
    // if the logic in your onStart implementation encounters and error
    // then call the error callback function, otherwise call the success callback
    const err = false;
    if (err) {
        this.logger.severe('TemplateWorker onStart error: something went wrong');
        error();
    } else {
        this.logger.fine('TemplateWorker onStart success');
        success();
    }
};

TemplateWorker.prototype.onStartCompleted = function onStartCompleted(success, error, state, errMsg) {
    if (errMsg) {
        this.logger.severe(`TemplateWorker onStartCompleted error: something went wrong ${errMsg}`);
        error();
    }
    this.setLxBlockStatus(this.projectName)
        .then(() => {
            this.logger.fine(`TemplateWorker state loaded: ${JSON.stringify(state)}`);
            success();
        })
        .catch((err) => {
            error(err);
        });
};

/** ***************
 * http handlers *
 **************** */

const as3HtmlView = (response) => {
    // we need to pre-process the declaration to make
    // it more suitable to build a mustache partial
    // build a list of tenants with a list of applications inside

    const declaration = response.body.declaration || response.body;
    const tenantList = Object.keys(declaration)
        .filter(k => declaration[k].class === 'Tenant')
        .map(k => Object.assign(declaration[k], { tname: k }));

    let count = 0;
    tenantList.forEach((t) => {
        t.applicationList = Object.keys(t)
            .filter(k => t[k].class === 'Application')
            .map(k => Object.assign(t[k], {
                aname: k,
                row: (count++ % 2) === 1 // eslint-disable-line no-plusplus
            }));

        // finally, we will take every object with a class
        // and build a class array inside the application

        t.applicationList.forEach((app) => {
            app.componentList = Object.keys(app)
                .filter(k => app[k].class !== undefined)
                .map(k => Object.assign(app[k], { cname: k }));
        });
    });

    const view = {
        table_rows: tenantList,
        tenant_summary() {
            const html = this.applicationList.map((a) => {
                if (a.label) {
                    return `<div class="highlight group">
          <div style="flex-grow: 1;">${a.name}</div><div>${a.constants}</div>
          </div>`;
                }
                return `<div class="group">${a.name}</div>`;
            }).join('');
            return html;
        }
    };


    const partial = {
        row_values: `<td><h2>{{tname}}</h2></td>
    <td><div class="container">
    {{#applicationList}}{{> applicationList }}{{/applicationList}}
    </div></td>`,
        applicationList: `
    <div>
      <div class="highlight group" {{#row}}style="background-color:{{CurrentLine}};"{{/row}}>
        <div style="flex-grow: 1;text-align:left;">
        {{#constants}}
        <a href="/iapps/mystique/?application_name={{aname}}&tenant_name={{tname}}">{{aname}}</a>
        {{/constants}}
        {{^constants}}
        <u>{{aname}}</u> No Form Values Stored
        {{/constants}}
        </div>
        {{#constants}}
        <div style="flex-grow: 1;text-align:right;">{{label}}</div>
        {{/constants}}
        {{^constants}}
        <div style="flex-grow: 1;text-align:right;">{{serviceMain.class}}</div>
        {{/constants}}
        <div><a href="?delete=on&application_name={{aname}}&tenant_name={{tname}}">DELETE</a></div>

      </div>
    </div>
    `,
        componentList: `
    <div>{{class}}</div>
    `
    };

    // partial.row_values = tenantsRow;

    const listBase = new HtmlTemplate('partial_html');
    const artifact = listBase.render(view, partial);

    return artifact;
};

TemplateWorker.prototype.onGet = function onGet(restOperation) {
    const uri = restOperation.getUri();
    this.logger.info(uri);
    const pathElements = uri.path.split('/');
    this.logger.info(pathElements);
    if (pathElements[3] === 'list') {
        const listHtmlTemplate = new HtmlTemplate('list_html');
        const listHtml = view => listHtmlTemplate.render(view);
        this.logger.info('trying to list...');
        // list templates
        return this.provider.list().then((templateList) => {
            const listHtmlView = {
                list_items: templateList,
                prop() { return this; }
            };

            restOperation.setHeaders('Content-Type', 'text/html');
            restOperation.setBody(listHtml(listHtmlView));
            this.completeRestOperation(restOperation);
        }).catch((e) => {
            try {
                restOperation.setBody({
                    code: 422,
                    message: e.message
                });
            } catch (_e) {
                this.logger.log(_e.message);

                restOperation.setBody({
                    code: 500,
                    message: e.stack,
                    well: _e.message
                });
            }
            this.completeRestOperation(restOperation);
        });
    }

    if (pathElements[3] === 'declaration') {
        const as3req = new ATRequest({
            ipaddress: 'localhost',
            username: 'admin',
            password: '',
            port: 8100
        });

        return as3req.declaration()
            .then((response) => {
                if (pathElements[4] && pathElements[5]) {
                    const tenant = pathElements[4];
                    const app = pathElements[5];
                    const declaration = response.body.declaration || response.body;
                    return this.provider.fetch(declaration[tenant][app].label)
                        .then((templateEngine) => {
                            console.log('CONSTANTS!!!', declaration[tenant][app].constants);
                            return templateEngine.loadWithDefaults(declaration[tenant][app].constants);
                        });
                }
                return as3HtmlView(response);
            })
            .then((html) => {
                restOperation.setHeaders('Content-Type', 'text/html');
                restOperation.setBody(html);
                this.completeRestOperation(restOperation);
            })
            .catch((e) => {
                restOperation.setBody({
                    code: 500,
                    message: e.stack
                });
                this.completeRestOperation(restOperation);
            });
    }

    // display template html/schema
    // as3-form-lx/templateName.json
    // return schema

    // as3-form-lx/templateName
    // as3-form-lx/templateName.html
    // return html form
    const templateName = pathElements[3] || 'f5_service';
    return this.provider.fetch(templateName)
        .then((templateEngine) => {
            restOperation.setHeaders('Content-Type', 'text/html');
            this.logger.info('trying to return...');
            this.logger.info(templateEngine);
            this.logger.info(templateEngine.formHtml);
            restOperation.setBody(templateEngine.formHtml());
            this.completeRestOperation(restOperation);
        })
        .catch((e) => {
            restOperation.setBody({
                code: 500,
                message: e.stack
            });
            this.completeRestOperation(restOperation);
        });
};

TemplateWorker.prototype.onPost = function onPost(restOperation) {
    const body = restOperation.getBody();
    const uri = restOperation.getUri();
    const pathElements = uri.path.split('/');
    const templateName = pathElements[3];

    // if x-http-form-encoded...
    const completedForm = JSON.parse(body);
    this.logger.info(uri);
    this.logger.info(body);
    this.logger.info(templateName);
    const appNames = [];
    let tenantName = '';
    const as3Req = new ATRequest({
        ipaddress: 'localhost',
        username: 'admin',
        password: '',
        port: 8100
    });
    return this.provider.fetch(templateName)
        .then((templateEngine) => {
        // execute :template
            this.logger.info('pre-render');
            this.logger.info(completedForm);
            const err = templateEngine.validate(completedForm);
            if (err) throw new Error(`template validation failed: ${JSON.stringify(err)}`);
            const rendered = templateEngine.render(completedForm);
            this.logger.info(rendered);
            return Promise.all([rendered, as3Req.declaration()]);
        })
        .then((declaration) => {
            const _new = declaration[0];
            const _existing = declaration[1].body;
            this.logger.info('post-render');
            console.log('new', _new);
            console.log('existing', _existing);
            // grab ADC class
            const _final = _existing.class === 'AS3' ? _existing.declaration : _existing;
            const _newadc = _new.class === 'AS3' ? _new.declaration : _new;
            // stitch...

            // filter out unwanted tenants
            Object.keys(_final).forEach((k) => {
                if (!_newadc[k]) delete _final[k];
            });
            console.log('before fin', _final);
            console.log('before adc', _newadc);
            console.log('keys', Object.keys(_newadc));
            console.log('keys', Object.keys(_newadc).filter(k => _newadc[k].class === 'Tenant'));
            Object.keys(_newadc)
                .filter(k => _newadc[k].class === 'Tenant')
                .forEach((k) => {
                    this.logger.info(`stitching ${k}`);
                    this.logger.info(JSON.stringify(_newadc[k]));
                    console.log('stitch', Object.keys(_newadc[k]));
                    tenantName = k;
                    appNames.push(Object.keys(_newadc[k]).filter(x => x !== 'class')[0]);
                    console.log(appNames);
                    if (_final[k]) Object.assign(_final[k], _newadc[k]);
                    else _final[k] = _newadc[k];
                });

            console.log('final after final mod');
            console.log(JSON.stringify(_final, null, 2));
            return as3Req.declare(_final);
        })
        .then((response) => {
            this.logger.info(JSON.stringify(response, null, 2));

            if (!response.body.results) throw new Error(`Report this irregular AS3 result:${JSON.stringify(response.body, null, 2)}`);

            restOperation.setBody({
                tenantName,
                application_name: appNames[0],
                results: response.body.results.filter(x => x.tenant)
            });
            this.completeRestOperation(restOperation);
        })
        .catch((e) => {
            console.log(e.stack);
            try {
                restOperation.setBody({
                    code: 422,
                    message: e.message
                });
            } catch (_e) {
                this.logger.log(_e.message);

                restOperation.setBody({
                    code: 500,
                    message: e.stack,
                    well: _e.message
                });
            }
            this.completeRestOperation(restOperation);
        });
};

// create new template file
TemplateWorker.prototype.onPut = function onPut(restOperation) {
    this.state = restOperation.getBody();
    this.completeRestOperation(restOperation);
};

// update existing template file
TemplateWorker.prototype.onPatch = function onPatch(restOperation) {
    this.state = restOperation.getBody();
    this.completeRestOperation(restOperation);
};

// delete template file
TemplateWorker.prototype.onDelete = function onDelete(restOperation) {
    const uri = restOperation.getUri();
    this.logger.info(uri);
    const pathElements = uri.path.split('/');
    const tenant = pathElements[3];
    const app = pathElements[4];
    const as3req = new ATRequest({
        ipaddress: 'localhost',
        username: 'admin',
        password: '',
        port: 8100
    });
    return as3req.declaration()
        .then((response) => {
            console.log('DELETE GET', response);
            const declaration = response.body.declaration || response.body;
            delete declaration[tenant][app];
            return as3req.declare(declaration);
        })
        .then((result) => {
            restOperation.setBody(result);
            this.completeRestOperation(restOperation);
        })
        .catch((e) => {
            console.log(e.stack);
            try {
                restOperation.setBody({
                    code: 422,
                    message: e.message
                });
            } catch (_e) {
                this.logger.log(_e.message);

                restOperation.setBody({
                    code: 500,
                    message: e.stack,
                    well: _e.message
                });
            }
            this.completeRestOperation(restOperation);
        });
};

TemplateWorker.prototype.httpRequest = function httpRequest(opts, payload) {
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
};

TemplateWorker.prototype.httpGet = function httpGet(path) {
    const opts = this.httpOpts;
    opts.path = path;
    return this.httpRequest(opts);
};

TemplateWorker.prototype.httpPost = function httpPost(path, payload) {
    const opts = this.httpOpts;
    opts.path = path;
    opts.method = 'POST';
    return this.httpRequest(opts, payload);
};

TemplateWorker.prototype.httpPatch = function httpPatch(path, payload) {
    const opts = this.httpOpts;
    opts.path = path;
    opts.method = 'PATCH';
    return this.httpRequest(opts, payload);
};

// LX block status controls the ball color shown in the BIG-IP UI.
// When at least one mustache app is deployed, set state to BOUND (green).
// When all are deleted, set state to UNBOUND (gray).
// TODO: resolve(block.id), refactor as (state, blockName) and if blockName is undefined, use stored blockId.
TemplateWorker.prototype.setLxBlockStatus = function setLxBlockStatus(blockName, state) {
    const blockData = {
        name: blockName,
        state: state || 'UNBOUND',
        configurationProcessorReference: {
            link: 'https://localhost/mgmt/shared/iapp/processors/noop'
        },
        presentationHtmlReference: {
            link: `https://localhost/iapps/${this.projectName}/index.html`
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
};

module.exports = TemplateWorker;
