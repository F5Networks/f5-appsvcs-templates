'use strict';

const fs = require('fs');

const ioUtil = require('./io_util.js');
const Template = require('./template').Template;

const ResourceCache = ioUtil.ResourceCache;
const makeRequest = ioUtil.makeRequest;

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

// used for listing AS3 templates available
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

function GitHubTemplateProvider(githubRepoPath) {
    this.githubRepoPath = githubRepoPath;

    this.list_opts = {
        host: 'api.github.com',
        path: `/repos/${githubRepoPath}/contents/templates/simple`,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/29.0.1521.3 Safari/537.36'
        }
    };

    this.fetch_opts = {
        host: 'raw.githubusercontent.com',
        path: 'path/to/directory/contents',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/29.0.1521.3 Safari/537.36'
        }
    };

    this.cache = new ResourceCache((templateName) => {
        this.fetch_opts.path = `/${this.githubRepoPath}/master/templates/simple/${templateName}.mst`;
        return makeRequest(this.fetch_opts).then(result => result.body);
    });

    return this;
}

GitHubTemplateProvider.prototype.fetch = function fetch(templateName) {
    return this.cache.fetch(templateName);
};

GitHubTemplateProvider.prototype.list = function list() {
    return makeRequest(this.list_opts).then((result) => {
        if (result.status === '404') {
            throw new Error(`Repository not found: ${this.githubRepoPath}`);
        }
        return JSON.parse(result.body)
            .map(fileMeta => fileMeta.name.split('.')[0]);
    });
};

function PostmanTemplateProvider(postmanCollection) {
    this.collection = postmanCollection;
    return this;
}

module.exports = {
    FsTemplateProvider,
    GitHubTemplateProvider,
    PostmanTemplateProvider
};
