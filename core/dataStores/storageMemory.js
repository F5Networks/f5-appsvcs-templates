'use strict';

class StorageMemory {
    constructor(initialData) {
        this.data = initialData || {};
    }

    keys() {
        return Promise.resolve(Object.keys(this.data));
    }

    hasItem(keyName) {
        if (!keyName) {
            return Promise.reject(new Error('Missing required argument keyName'));
        }
        return Promise.resolve(typeof this.data[keyName] !== 'undefined');
    }

    getItem(keyName) {
        if (!keyName) {
            return Promise.reject(new Error('Missing required argument keyName'));
        }
        return Promise.resolve(this.data[keyName]);
    }

    setItem(keyName, keyValue) {
        if (!keyName) {
            return Promise.reject(new Error('Missing required argument keyName'));
        }
        this.data[keyName] = keyValue;
        return Promise.resolve();
    }
}

module.exports = StorageMemory;
