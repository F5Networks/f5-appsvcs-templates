const fs = require('fs');

const TemplateEngine = require('./template_engine.js').TemplateEngine;

const io_util = require('./io_util.js');
const ResourceCache = io_util.ResourceCache;
const makeRequest = io_util.makeRequest;

const FsSchemaProvider = require('./schema_provider.js').FsSchemaProvider;

function FsTemplateProvider(template_root_path, schema_root_path) {
    this.config_template_path = template_root_path;
    this.config_schema_path = schema_root_path;
    this.schema_provider = new FsSchemaProvider(schema_root_path);

    this.cache = new ResourceCache(template_name => new Promise((resolve, reject) => {
        fs.readFile(`${template_root_path}/${template_name}.mst`, (err, data) => {
            if (err) reject(err);
            else {
                resolve(data.toString('utf8'));
            }
        });
    }).then((data) => {
        if (!this.schemaSet) {
            return this.schema_provider.schemaSet()
                .then((schemas) => {
                    this.schemaSet = schemas;
                    return new TemplateEngine(template_name, data, this.schemaSet);
                });
        }
        return new TemplateEngine(template_name, data, this.schemaSet);
    }));

    return this;
}

FsTemplateProvider.prototype.fetch = function (key) {
    return this.cache.fetch(key);
};

// used for listing AS3 templates available
FsTemplateProvider.prototype.list = function () {
    return new Promise((resolve, reject) => {
        fs.readdir(this.config_template_path, (err, data) => {
            if (err) reject(err);

            const template_list = data.filter(x => x.endsWith('.mst'))
                .map(x => x.split('.')[0]);
            resolve(template_list);
        });
    });
};

function GitHubTemplateProvider(github_repo_path) {
    this.github_repo_path = github_repo_path;

    this.list_opts = {
        host: 'api.github.com',
        path: `/repos/${github_repo_path}/contents/templates/simple`,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/29.0.1521.3 Safari/537.36',
        },
    };

    this.fetch_opts = {
        host: 'raw.githubusercontent.com',
        path: 'path/to/directory/contents',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/29.0.1521.3 Safari/537.36',
        },
    };

    this.cache = new ResourceCache((template_name) => {
        this.fetch_opts.path = `/${this.github_repo_path}/master/templates/simple/${template_name}.mst`;
        return makeRequest(this.fetch_opts).then(result => result.body);
    });

    return this;
}

GitHubTemplateProvider.prototype.fetch = function (template_name) {
    return this.cache.fetch(template_name);
};

GitHubTemplateProvider.prototype.list = function () {
    return makeRequest(this.list_opts).then((result) => {
        if (result.status === '404') {
            throw new Error(`Repository not found: ${this.github_repo_path}`);
        }
        return JSON.parse(result.body)
            .map(file_meta => file_meta.name.split('.')[0]);
    });
};

function PostmanTemplateProvider(postman_collection) {
    this.collection = postman_collection;
    return this;
}

module.exports = {
    FsTemplateProvider,
    GitHubTemplateProvider,
    PostmanTemplateProvider,
};
