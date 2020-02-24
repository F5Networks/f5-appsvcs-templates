'use strict';

const fs = require('fs');
const path = require('path');

const ResourceCache = require('./resource_cache').ResourceCache;
const Template = require('./template').Template;
const { FsSchemaProvider } = require('./schema_provider');

class FsTemplateProvider {
    constructor(templateRootPath, filteredSets) {
        this.config_template_path = templateRootPath;
        this.schemaProviders = {};
        this.filteredSets = new Set(filteredSets || []);

        this.cache = new ResourceCache((templateName) => {
            const tsName = templateName.split('/')[0];
            if (!this.schemaProviders[tsName]) {
                this.schemaProviders[tsName] = new FsSchemaProvider(`${templateRootPath}/${tsName}`);
            }
            const schemaProvider = this.schemaProviders[tsName];
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
            }).then(tmpldata => Template[(useMst) ? 'loadMst' : 'loadYaml'](tmpldata, schemaProvider));
        });
    }

    fetch(key) {
        return this.cache.fetch(key);
    }

    invalidateCache() {
        this.cache.invalidate();
    }

    listSets() {
        return new Promise((resolve, reject) => {
            fs.readdir(this.config_template_path, (err, files) => {
                if (err) return reject(err);
                return resolve(files.filter(x => (
                    fs.lstatSync(path.join(this.config_template_path, x)).isDirectory()
                    && (this.filteredSets.size === 0 || this.filteredSets.has(x))
                )));
            });
        });
    }

    list() {
        return this.listSets()
            .then(sets => Promise.all(sets.map(setName => new Promise((resolve, reject) => {
                fs.readdir(path.join(this.config_template_path, setName), (err, files) => {
                    if (err) return reject(err);
                    return resolve(
                        files
                            .filter(x => x.endsWith('.yml') || x.endsWith('.yaml') || x.endsWith('.mst'))
                            .map((x) => {
                                const tmplExt = x.split('.').pop();
                                let tmplName = '';
                                if (tmplExt === 'mst' || tmplExt === 'yml') {
                                    tmplName = x.slice(0, -4);
                                } else if (tmplExt === 'yaml') {
                                    tmplName = x.slice(0, -5);
                                }
                                return `${setName}/${tmplName}`;
                            })
                    );
                });
            })))).then(sets => sets.reduce((acc, curr) => acc.concat(curr), []));
    }
}

class DataStoreTemplateProvider {
    constructor(datastore, filteredSets) {
        this.filteredSets = new Set(filteredSets || []);
        this.storage = datastore;
        this.keyCache = [];

        this.cache = new ResourceCache((templatePath) => {
            const [tsName, templateName] = templatePath.split('/');
            return this.storage.hasItem(tsName)
                .then((result) => {
                    if (result) {
                        return Promise.resolve();
                    }
                    return Promise.reject(new Error(`Could not find template set "${tsName}" in data store`));
                })
                .then(() => this.storage.getItem(tsName))
                .then((tsData) => {
                    const templateData = tsData.templates[templateName];

                    if (typeof templateData === 'undefined') {
                        return Promise.reject(new Error(`Could not find template "${templateName}" in template set "${tsName}"`));
                    }
                    return Template.fromJson(JSON.parse(templateData));
                });
        });
    }

    fetch(key) {
        return this.cache.fetch(key);
    }

    invalidateCache() {
        this.cache.invalidate();
        this.keyCache = [];
    }

    listSets() {
        if (this.keyCache.length !== 0) {
            return Promise.resolve(this.keyCache);
        }

        return this.storage.keys()
            .then(keys => keys.filter(x => this.filteredSets.size === 0 || this.filteredSets.has(x)))
            .then((keys) => {
                this.keyCache = keys;
                return keys;
            });
    }

    list() {
        return this.listSets()
            .then(templateSets => Promise.all(templateSets.map(x => this.storage.getItem(x))))
            .then((templateSets) => {
                let templates = [];
                templateSets.forEach((tsData) => {
                    if (tsData) {
                        const tmplNames = Object.keys(tsData.templates).map(tmplName => `${tsData.name}/${tmplName}`);
                        templates = templates.concat(tmplNames);
                    }
                });
                return templates;
            });
    }

    static fromFs(datastore, templateRootPath, filteredSets) {
        filteredSets = new Set(filteredSets || []);
        const fsprovider = new FsTemplateProvider(templateRootPath, filteredSets);
        const tsList = {};
        return fsprovider.list()
            .then(tmplList => Promise.all(tmplList.map(
                tmplPath => fsprovider.fetch(tmplPath)
                    .then((tmplData) => {
                        const [tsName, tmplName] = tmplPath.split('/');
                        if (!tsList[tsName]) {
                            tsList[tsName] = {};
                        }
                        tsList[tsName][tmplName] = JSON.stringify(tmplData);
                    })
            )))
            .then(() => {
                let promiseChain = Promise.resolve();
                Object.keys(tsList).forEach((tsName) => {
                    const tmplData = tsList[tsName];
                    const schemas = fs.readdirSync(`${templateRootPath}/${tsName}`)
                        .filter(x => x.split('.').pop() === 'json')
                        .reduce((acc, curr) => {
                            const schemaPath = `${templateRootPath}/${tsName}/${curr}`;
                            acc[curr.slice(0, -5)] = fs.readFileSync(schemaPath, { encoding: 'utf8' });
                            return acc;
                        }, {});
                    const tsData = {
                        name: tsName,
                        schemas,
                        templates: tmplData
                    };
                    promiseChain = promiseChain.then(() => datastore.setItem(tsName, tsData));
                });
                return promiseChain;
            });
    }
}

module.exports = {
    FsTemplateProvider,
    DataStoreTemplateProvider
};
