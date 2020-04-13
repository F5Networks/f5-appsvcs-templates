'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const ResourceCache = require('./resource_cache').ResourceCache;
const Template = require('./template').Template;
const { FsSchemaProvider } = require('./schema_provider');

// Known good hashes for template sets
const supportedHashes = {
    'bigip-fast-templates': [
        '3d6fe84f925f76edd40778c80f311adde74c434a24e54f920708efb18a6a3dea', // v0.4
        '76cb4510149798456ae271ed8c43c195a67f5e4f249ec6550dff5eb3137ed281' //  v0.3
    ],
    examples: [
        'd0e708656e03573db98b96924e34ec22c1adfc71a6a78e3fa780d51c2b5dede5' //  v0.3
    ]
};


class BaseTemplateProvider {
    constructor() {
        if (new.target === BaseTemplateProvider) {
            throw new TypeError('Cannot instantiate Abstract BaseTemplateProvider');
        }

        const abstractMethods = [
            '_loadTemplate',
            'listSets',
            'removeSet',
            'list',
            'getSchemas'
        ];
        abstractMethods.forEach((method) => {
            if (this[method] === undefined) {
                throw new TypeError(`Expected ${method} to be defined`);
            }
        });


        this.cache = new ResourceCache((tmplName => this._loadTemplate(tmplName)));
    }

    invalidateCache() {
        this.cache.invalidate();
    }

    fetch(key) {
        return this.cache.fetch(key);
    }

    fetchSet(setName) {
        return this.list(setName)
            .then(tmplList => Promise.all(tmplList.map(tmplName => Promise.all([
                Promise.resolve(tmplName),
                this.fetch(tmplName)
            ]))))
            .then(tmplList => tmplList.reduce((acc, curr) => {
                const [tmplName, tmplData] = curr;
                acc[tmplName] = tmplData;
                return acc;
            }, {}));
    }

    hasSet(setid) {
        return this.listSets()
            .then(sets => sets.includes(setid));
    }

    getNumTemplateSourceTypes(filteredSetName) {
        const sourceTypes = {};
        const filteredSetList = (filteredSetName && [filteredSetName]) || [];
        return this.list(filteredSetList)
            .then(tmplList => Promise.all(tmplList.map(tmpl => this.fetch(tmpl))))
            .then(tmplList => tmplList.forEach((tmpl) => {
                if (!sourceTypes[tmpl.sourceType]) {
                    sourceTypes[tmpl.sourceType] = 0;
                }
                sourceTypes[tmpl.sourceType] += 1;
            }))
            .then(() => sourceTypes);
    }

    getNumSchema(filteredSetName) {
        return this.getSchemas(filteredSetName)
            .then(schemas => Object.keys(schemas).length);
    }

    getSetData(setName) {
        return Promise.all([
            this.fetchSet(setName),
            this.getSchemas(setName)
        ])
            .then(([templates, schemas]) => {
                if (Object.keys(templates).length === 0) {
                    return Promise.reject(new Error(`No templates found for template set ${setName}`));
                }
                const tsHash = crypto.createHash('sha256');
                const tmplHashes = Object.values(templates).map(x => x.sourceHash).sort();
                tmplHashes.forEach((hash) => {
                    tsHash.update(hash);
                });
                const schemaHashes = Object.values(schemas).map(x => x.hash).sort();
                schemaHashes.forEach((hash) => {
                    tsHash.update(hash);
                });

                const tsHashDigest = tsHash.digest('hex');
                const supported = (
                    Object.keys(supportedHashes).includes(setName)
                    && supportedHashes[setName].includes(tsHashDigest)
                );
                return Promise.resolve({
                    name: setName,
                    hash: tsHashDigest,
                    supported,
                    templates: Object.keys(templates).reduce((acc, curr) => {
                        const tmpl = templates[curr];
                        acc.push({
                            name: curr,
                            hash: tmpl.sourceHash
                        });
                        return acc;
                    }, []),
                    schemas: Object.keys(schemas).reduce((acc, curr) => {
                        const schema = schemas[curr];
                        acc.push({
                            name: schema.name,
                            hash: schema.hash
                        });
                        return acc;
                    }, [])
                });
            });
    }
}

class FsTemplateProvider extends BaseTemplateProvider {
    constructor(templateRootPath, filteredSets) {
        super();
        this.config_template_path = templateRootPath;
        this.schemaProviders = {};
        this.filteredSets = new Set(filteredSets || []);
    }

    _loadTemplate(templateName) {
        const tsName = templateName.split('/')[0];
        this._ensureSchemaaProvider(tsName);
        const schemaProvider = this.schemaProviders[tsName];
        let useMst = 0;
        let tmplpath = `${this.config_template_path}/${templateName}`;
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
    }

    _ensureSchemaaProvider(tsName) {
        if (!this.schemaProviders[tsName]) {
            this.schemaProviders[tsName] = new FsSchemaProvider(`${this.config_template_path}/${tsName}`);
        }
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

    list(setList) {
        setList = setList || [];
        return this.listSets()
            .then(sets => sets.filter(x => setList.length === 0 || setList.includes(x)))
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
            })))).then(sets => sets.reduce((acc, curr) => acc.concat(curr), []))
            .then((sets) => {
                sets.forEach(set => this._ensureSchemaaProvider(set));
                return sets;
            });
    }

    getSchemas(filteredSetName) {
        const schemas = {};
        return Promise.resolve()
            .then(() => {
                if (filteredSetName) {
                    return Promise.resolve([filteredSetName]);
                }
                return this.listSets();
            })
            .then((setList) => {
                setList.forEach(tsName => this._ensureSchemaaProvider(tsName));
                return setList;
            })
            .then(setList => Promise.all(setList.map(
                tsName => this.schemaProviders[tsName].list()
                    .then(schemaList => Promise.all(schemaList.map(
                        schemaName => this.schemaProviders[tsName].fetch(schemaName)
                            .then((schemaData) => {
                                const name = `${tsName}/${schemaName}`;
                                const schemaHash = crypto.createHash('sha256');
                                schemaHash.update(schemaData);
                                schemas[name] = {
                                    name,
                                    data: schemaData,
                                    hash: schemaHash.digest('hex')
                                };
                            })
                    )))
            )))
            .then(() => schemas);
    }

    removeSet() {
        return Promise.reject(new Error('Set removal not implemented'));
    }

    buildPackage(setName, dst) {
        const archive = archiver('zip');
        const output = fs.createWriteStream(dst);
        const source = `${this.config_template_path}/${setName}`;

        return new Promise((resolve, reject) => {
            archive
                .directory(source, false)
                .on('error', err => reject(err))
                .pipe(output);
            output.on('close', () => resolve());
            archive.finalize();
        });
    }
}

class DataStoreTemplateProvider extends BaseTemplateProvider {
    constructor(datastore, filteredSets) {
        super();
        this.filteredSets = new Set(filteredSets || []);
        this.storage = datastore;
        this.keyCache = [];
        this._numSchema = {};
    }

    _loadTemplate(templatePath) {
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
            })
            .then(tmpl => tmpl);
    }

    invalidateCache() {
        super.invalidateCache();
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

    list(setList) {
        setList = setList || [];
        return this.listSets()
            .then(sets => sets.filter(x => setList.length === 0 || setList.includes(x)))
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

    removeSet(setid) {
        return this.hasSet(setid)
            .then(result => (result || Promise.reject(
                new Error(`failed to find template set: ${setid}`)
            )))
            .then(() => this.storage.deleteItem(setid))
            .then(() => this.invalidateCache());
    }

    getSchemas(filteredSetName) {
        return Promise.resolve()
            .then(() => {
                if (filteredSetName) {
                    return Promise.resolve([filteredSetName]);
                }
                return this.listSets();
            })
            .then(setNames => Promise.all(setNames.map(x => this.storage.getItem(x))))
            .then(setData => setData.filter(x => x))
            .then(setData => setData.reduce((acc, curr) => {
                const tsName = curr.name;
                Object.keys(curr.schemas).forEach((schemaName) => {
                    const schemaData = curr.schemas[schemaName];
                    const name = `${tsName}/${schemaName}`;
                    const schemaHash = crypto.createHash('sha256');
                    schemaHash.update(schemaData);
                    acc[name] = {
                        name,
                        data: schemaData,
                        hash: schemaHash.digest('hex')
                    };
                });
                return acc;
            }, {}));
    }

    static fromFs(datastore, templateRootPath, filteredSets) {
        filteredSets = new Set(filteredSets || []);
        const fsprovider = new FsTemplateProvider(templateRootPath, filteredSets);
        let promiseChain = Promise.resolve();

        return Promise.resolve()
            .then(() => fsprovider.listSets())
            .then(setList => Promise.all(setList.map(tsName => Promise.all([
                fsprovider.fetchSet(tsName),
                fsprovider.getSchemas(tsName)
            ])
                .then(([setTemplates, setSchemas]) => {
                    const templates = Object.entries(setTemplates).reduce((acc, curr) => {
                        const [tmplPath, tmplData] = curr;
                        const tmplName = tmplPath.split('/')[1];
                        acc[tmplName] = JSON.stringify(tmplData);
                        return acc;
                    }, {});
                    const schemas = Object.entries(setSchemas).reduce((acc, curr) => {
                        const [schemaPath, schemaData] = curr;
                        const schemaName = schemaPath.split('/')[1];
                        acc[schemaName] = schemaData.data;
                        return acc;
                    }, {});

                    const tsData = {
                        name: tsName,
                        templates,
                        schemas
                    };

                    // DataStores do not guarantee support for parallel writes
                    promiseChain = promiseChain.then(() => datastore.setItem(tsName, tsData));
                }))))
            .then(() => promiseChain);
    }
}

module.exports = {
    FsTemplateProvider,
    DataStoreTemplateProvider
};
