'use strict';

const fs = require('fs');

const ResourceCache = require('./resource_cache').ResourceCache;

class FsSchemaProvider {
    constructor(schemaRootPath) {
        this.schema_path = schemaRootPath;
        this.cache = new ResourceCache(schemaName => new Promise((resolve, reject) => {
            fs.readFile(`${schemaRootPath}/${schemaName}.json`, (err, data) => {
                if (err) return reject(err);
                return resolve(data.toString('utf8'));
            });
        }));
    }

    fetch(key) {
        return this.cache.fetch(key);
    }

    list() {
        return new Promise((resolve, reject) => {
            fs.readdir(this.schema_path, (err, data) => {
                if (err) return reject(err);

                const list = data.filter(x => x.endsWith('.json'))
                    .map(x => x.split('.')[0]);
                return resolve(list);
            });
        });
    }
}

class DataStoreSchemaProvider {
    constructor(datastore, tsName) {
        this.storage = datastore;
        this.tsName = tsName;
        this.cache = new ResourceCache(
            schemaName => this.storage.hasItem(this.tsName)
                .then((result) => {
                    if (result) {
                        return Promise.resolve();
                    }
                    return Promise.reject(new Error(`Could not find template set "${this.tsName}" in data store`));
                })
                .then(() => this.storage.getItem(this.tsName))
                .then(ts => ts.schemas[schemaName])
                .then((schema) => {
                    if (typeof schema === 'undefined') {
                        return Promise.reject(new Error(`Failed to find schema named "${schemaName}"`));
                    }
                    return Promise.resolve(schema);
                })
        );
    }

    fetch(key) {
        return this.cache.fetch(key);
    }

    list() {
        return this.storage.hasItem(this.tsName)
            .then((result) => {
                if (result) {
                    return Promise.resolve();
                }
                return Promise.reject(new Error(`Could not find template set "${this.tsName}" in data store`));
            })
            .then(() => this.storage.getItem(this.tsName))
            .then(ts => Object.keys(ts.schemas));
    }
}

module.exports = {
    FsSchemaProvider,
    DataStoreSchemaProvider
};
