'use strict';

const http = require('http');
const zlib = require('zlib');

const childProcess = require('child_process');

const ZLIB_OPTIONS = {
    level: zlib.Z_BEST_COMPRESSION,
    windowBits: 15
};

function fromBase64(input) {
    return Buffer.from(input, 'base64');
}

function filterDuplicateResourceError(error) {
    if (!error.message.includes('already exists')) {
        throw error;
    }
}

function stringToRecords(baseKey, string, offset) {
    const compressedString = zlib.deflateSync(string, ZLIB_OPTIONS);

    const records = [];
    let base64String = compressedString.toString('base64');
    for (let counter = offset || 0; base64String.length; counter += 1) {
        const chunk = base64String.substr(0, 64512);
        records.push({
            name: `${baseKey}${counter}`,
            data: chunk
        });
        base64String = base64String.substr(64512);
    }

    return records;
}

function recordsToString(records, baseKey, offset) {
    let base64String = '';
    for (let i = offset || 0; i < records.length; i += 1) {
        const recordName = `${baseKey}${i}`;
        const record = records.find(r => r.name === recordName);
        if (record) {
            base64String += record.data;
        }
    }
    const compresedString = fromBase64(base64String);
    const finalString = zlib.inflateSync(compresedString, ZLIB_OPTIONS).toString();
    return finalString;
}


function executeCommand(command) {
    return new Promise((resolve, reject) => {
        childProcess.exec(command, (error, stdout, stderr) => {
            if (error) reject(error);
            else if (stderr) reject(new Error(stderr));
            else resolve(stdout);
        });
    });
}

function addFolder(path) {
    return executeCommand(`tmsh -a create sys folder ${path}`);
}

function addDataGroup(path) {
    return executeCommand(`tmsh -a create ltm data-group internal ${path} type string`);
}

function updateDataGroup(path, records) {
    const tmshRecords = records
        .map(record => `${record.name} { data ${record.data} }`)
        .join(' ');
    // eslint-disable-next-line max-len
    const command = `tmsh -a modify ltm data-group internal ${path} records replace-all-with { ${tmshRecords} }`;
    return executeCommand(command);
}

function readDataGroup(path) {
    return executeCommand(`tmsh -a list ltm data-group internal ${path}`);
}

function outputToObject(output) {
    const jsonString = output
        .replace(/ltm data-group internal .*? {/, '{')
        .replace(/(\s*)(.*?) {/g, '$1"$2" : {')
        .replace(/( {8}})(\s*")/gm, '$1,$2')
        .replace(/(\s*)data (.*?)(\s*)}/gm, '$1"data": "$2"$3}')
        .replace(/^( {4}})/m, '$1,')
        .replace('type string', '"type": "string"');
    return JSON.parse(jsonString);
}

function recordsToKeys(records) {
    const recordNames = records.map(x => x.name);
    const keynames = [];

    let lastKeyname = '';
    let recordCounter = -1;
    while (recordNames.length !== 0) {
        const nextCounter = recordCounter + 1;
        const nextRecordName = recordNames.shift();
        if (nextRecordName === `${lastKeyname}${nextCounter}`) {
            // Still working on the same key
            recordCounter = nextCounter;
        } else {
            // New key
            lastKeyname = nextRecordName.slice(0, -1);
            recordCounter = 0;
            keynames.push(lastKeyname);
        }
    }

    return keynames;
}

class StorageDataGroup {
    constructor(path) {
        this.length = 0;
        this.path = path;
        this._ready = false;
    }

    ensureFolder() {
        const path = this.path.split('/').slice(0, -1).join('/');
        return addFolder(path).catch(filterDuplicateResourceError);
    }

    ensureDataGroup() {
        return addDataGroup(this.path).catch(filterDuplicateResourceError);
    }


    _lazyInit() {
        if (this._ready) {
            return Promise.resolve();
        }

        return Promise.resolve()
            .then(() => this.ensureFolder())
            .then(() => this.ensureDataGroup())
            .then(() => {
                this._ready = true;
            });
    }

    _getRecords() {
        return Promise.resolve()
            .then(() => readDataGroup(this.path))
            .then(data => outputToObject(data))
            .then(data => data.records || {})
            .then(records => Object.keys(records).map(
                key => Object.assign({ name: key }, records[key])
            ));
    }

    keys() {
        return Promise.resolve()
            .then(() => this._lazyInit())
            .then(() => this._getRecords())
            .then(records => recordsToKeys(records));
    }

    hasItem(keyName) {
        if (!keyName) {
            return Promise.reject(new Error('Missing required argument keyName'));
        }

        return Promise.resolve()
            .then(() => this.getItem(keyName))
            .then(data => typeof data !== 'undefined');
    }

    setItem(keyName, keyValue) {
        if (!keyName) {
            return Promise.reject(new Error('Missing required argument keyName'));
        }

        return Promise.resolve()
            .then(() => this._lazyInit())
            .then(() => this._getRecords())
            .then((currentRecords) => {
                const string = JSON.stringify(keyValue);
                const records = currentRecords.concat(stringToRecords(keyName, string));
                return updateDataGroup(this.path, records);
            });
    }

    getItem(keyName) {
        if (!keyName) {
            return Promise.reject(new Error('Missing required argument keyName'));
        }

        return Promise.resolve()
            .then(() => this._lazyInit())
            .then(() => this._getRecords())
            .then(records => recordsToString(records, keyName))
            .then(data => JSON.parse(data));
    }

    persist() {
        const opts = {
            host: 'localhost',
            port: 8100,
            path: '/mgmt/tm/task/sys/config',
            method: 'POST',
            send: JSON.stringify({ command: 'save' }),
            headers: {
                Authorization: `Basic ${Buffer.from('admin:').toString('base64')}`,
                'Content-Type': 'application/json'
            }
        };

        return new Promise((resolve, reject) => {
            const req = http.request(opts, (res) => {
                const buffer = [];
                res.setEncoding('utf8');
                res.on('data', (data) => {
                    buffer.push(data);
                });
                res.on('end', () => {
                    let body = buffer.join('');
                    body = body || '{}';
                    try {
                        body = JSON.parse(body);
                    } catch (e) {
                        return reject(new Error(`Invalid response object from ${opts.method} to ${opts.path}`));
                    }
                    return resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body
                    });
                });
            });

            req.on('error', (e) => {
                reject(new Error(`${opts.host}:${e.message}`));
            });

            req.end();
        });
    }
}

module.exports = StorageDataGroup;
