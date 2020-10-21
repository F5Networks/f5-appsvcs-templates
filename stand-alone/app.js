'use strict';

const path = require('path');

process.AFL_TW_ROOT = '.';
process.AFL_TW_TS = path.join(__dirname, '../templates');

const fast = require('@f5devcentral/f5-fast-core');

const FastWorker = require('../iappslx/nodejs/fastWorker');
const expressAdapter = require('./expressAdapter');

const port = 8080;

const worker = new FastWorker();
worker.storage = new fast.dataStores.StorageMemory();
worker.templateProvider.storage = worker.storage;
worker.configStorage = new fast.dataStores.StorageMemory();

expressAdapter.generateApp(worker)
    .then(app => app.listen(port));
