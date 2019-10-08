const fs = require('fs');

const ResourceCache = require('./io_util.js').ResourceCache;

function FsSchemaProvider(schema_root_path) {
    this.schema_path = schema_root_path;
    this.cache = new ResourceCache(schema_name => new Promise((resolve, reject) => {
        fs.readFile(`${schema_root_path}/${schema_name}.json`, (err, data) => {
            if (err) reject(err);
            else {
                resolve(data.toString('utf8'));
            }
        });
    }));

    return this;
}

FsSchemaProvider.prototype.fetch = function (key) {
    return this.cache.fetch(key);
};

// used for listing AS3 templates available
FsSchemaProvider.prototype.schemaList = function () {
    return new Promise((resolve, reject) => {
        fs.readdir(this.schema_path, (err, data) => {
            if (err) reject(err);

            const schema_list = data.filter(x => x.endsWith('.json'))
                .map(x => x.split('.')[0]);
            resolve(schema_list);
        });
    });
};

FsSchemaProvider.prototype.schemaSet = function () {
    return this.cache.fetch('f5')
        .then(result => ({ f5: JSON.parse(result) }));
};

module.exports = {
    FsSchemaProvider,
};
