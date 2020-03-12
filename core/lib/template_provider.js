'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ResourceCache = require('./resource_cache').ResourceCache;
const Template = require('./template').Template;
const { FsSchemaProvider } = require('./schema_provider');

// Known good hashes for template sets
const supportedHashes = {
    'bigip-fast-templates': [
        '1c5977c927c90b1b2776741886f8109bee7e5d29e871ad3d9b896991b8cdcc68',
        'd67cd5ffdb60e6b42920147030d534ae3a123bb2ea13d15c00876937c717b67e',
        'b29e5ebeb19803cf382bea0a033f1351d374ca327386ff6102deb44721caf2cb'
    ],
    examples: [
        'ecf1dce5b54ecab68567c4e26a7bbee777f8f6b2affd005d408f4699192ffb1b'
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
            'getNumSchema'
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

    getSetData(setName) {
        return this.fetchSet(setName)
            .then((templates) => {
                if (Object.keys(templates).length === 0) {
                    return Promise.reject(new Error(`No templates found for template set ${setName}`));
                }
                const tsHash = crypto.createHash('sha256');
                const tmplHashes = Object.values(templates).map(x => x.sourceHash).sort();
                tmplHashes.forEach((hash) => {
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
        if (!this.schemaProviders[tsName]) {
            this.schemaProviders[tsName] = new FsSchemaProvider(`${this.config_template_path}/${tsName}`);
        }
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
            })))).then(sets => sets.reduce((acc, curr) => acc.concat(curr), []));
    }

    getNumSchema(filteredSetName) {
        return Promise.resolve()
            .then(() => {
                if (filteredSetName) {
                    return Promise.resolve([filteredSetName]);
                }
                return this.listSets();
            })
            .then(setList => setList.map(x => this.schemaProviders[x].list()))
            .then(schemaLists => schemaLists.flat().length);
    }

    removeSet() {
        return Promise.reject(new Error('Set removal not implemented'));
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
            });
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

    getNumSchema(filteredSetName) {
        return Promise.resolve()
            .then(() => {
                if (filteredSetName) {
                    return Promise.resolve([filteredSetName]);
                }
                return this.listSets();
            })
            .then(setNames => Promise.all(setNames.map(x => this.storage.getItem(x))))
            .then(sets => sets.reduce((acc, curr) => acc + Object.keys(curr.schemas).length, 0));
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
