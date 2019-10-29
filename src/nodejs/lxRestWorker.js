/*
 * Copyright 2019. F5 Networks, Inc. See End User License Agreement ("EULA") for
 * license terms. Notwithstanding anything to the contrary in the EULA, Licensee
 * may copy and modify this software product for its internal business purposes.
 * Further, Licensee may upload, publish and distribute the modified version of
 * the software product on devcentral.f5.com.
 */


'use strict';

const mustache = require('mustache');
const io = require('../lib/io_util.js');
const formsProvider = require('../lib/formsProvider.js');

class LxRestWorker {
    constructor() {
        this.projectName = 'mystique';
        this.WORKER_URI_PATH = `shared/${this.projectName}`;
        this.templatesDir = `/var/config/rest/iapps/${this.projectName}/templates`;
        this.schemasDir = `/var/config/rest/iapps/${this.projectName}/schemas`;
        this.forms = {};
        this.isPublic = true;
        this.isPassThrough = true;
        io.log(process.env.PWD);
    }

    onStartCompleted(success, failure) {
        io.setLxBlockStatus(this.projectName)
            .then(() => {
                success();
            })
            .catch((err) => {
                failure(err);
            });
    }

    complete(restOperation, body) {
        restOperation.setBody(body);
        restOperation.setHeaders('Content-Type', 'application/json');
        this.completeRestOperation(restOperation);
    }

    onGet(restOperation) {
        const path = restOperation.getUri().path.split('/');
        const resourceType = path[3];
        const resourceName = path[4] || null;

        io.log(`mystique GET /${resourceType}`);
        switch(resourceType) {
        case 'forms':
            this.forms = formsProvider.getForms(this.templatesDir, this.schemasDir);
            this.complete(restOperation, this.forms);
            break;
        case 'form':
            this.complete(restOperation, this.forms[resourceName]);
            break;
        }
    }

    onPost(restOperation) {
        const path = restOperation.getUri().path.split('/');
        const resourceType = path[3];
        const resourceName = path[4] || null;
        const body = restOperation.getBody();

        let mustacheTemplate, renderedDeclaration;
        switch(resourceType) {
        case 'form':
            mustacheTemplate = formsProvider.getSimplifiedTemplate(this.templatesDir, resourceName);
            io.log(`mustache template: ${mustacheTemplate}`);
            renderedDeclaration = mustache.render(mustacheTemplate, body);
            io.log(`mustache rendered: ${renderedDeclaration}`);
            io.log(`rendered type: ${typeof renderedDeclaration}`);
            try {
                JSON.parse(renderedDeclaration);
            } catch (err) {
                this.complete(restOperation, `declaration is not valid JSON: ${renderedDeclaration}`);
            }
            this.complete(restOperation, renderedDeclaration);
            break;
        }
    }
}

module.exports = LxRestWorker;
