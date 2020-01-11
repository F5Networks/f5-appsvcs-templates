'use strict';

const fs = require('fs');

const ioUtil = require('./io_util.js');
const Template = require('./template').Template;

const ResourceCache = ioUtil.ResourceCache;

function FsTemplateProvider(templateRootPath, schemaProvider) {
    this.config_template_path = templateRootPath;

    this.cache = new ResourceCache((templateName) => {
        let useMst = 0;
        let tmplpath = `${templateRootPath}/${templateName}`;
        if (fs.existsSync(`${tmplpath}.yml`)) {
            tmplpath = `${tmplpath}.yml`;
        } else if (fs.existsSync(`${tmplpath}.yaml`)) {
            tmplpath = `${tmplpath}.yaml`;
        } else if (fs.existsSync(`${tmplpath}.mst`)) {
            useMst = 1;
            tmplpath = `${tmplpath}.mst`;
        } else {
            return Promise.reject(new Error(`could not find a template with name "${templateName}"`));
        }

        return new Promise((resolve, reject) => {
            fs.readFile(tmplpath, (err, data) => {
                if (err) reject(err);
                else {
                    resolve(data.toString('utf8'));
                }
            });
        }).then(tmpldata => Template[(useMst) ? 'loadMst' : 'loadYaml'](schemaProvider, tmpldata));
    });

    return this;
}

FsTemplateProvider.prototype.fetch = function fetch(key) {
    return this.cache.fetch(key);
};

FsTemplateProvider.prototype.list = function list() {
    return new Promise((resolve, reject) => {
        fs.readdir(this.config_template_path, (err, data) => {
            if (err) reject(err);
            resolve(data);
        });
    }).then(data => data.filter(x => x.endsWith('.yml') || x.endsWith('.yaml') || x.endsWith('.mst')).map((x) => {
        const tmplExt = x.split('.').pop();
        let tmplName = '';
        if (tmplExt === 'mst' || tmplExt === 'yml') {
            tmplName = x.slice(0, -4);
        } else if (tmplExt === 'yaml') {
            tmplName = x.slice(0, -5);
        }
        return tmplName;
    }));
};

module.exports = {
    FsTemplateProvider
};
