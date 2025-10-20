/*
 * Copyright 2025. F5 Networks, Inc. See End User License Agreement ("EULA") for
 * license terms. Notwithstanding anything to the contrary in the EULA, Licensee
 * may copy and modify this software product for its internal business purposes.
 * Further, Licensee may upload, publish and distribute the modified version of
 * the software product on devcentral.f5.com.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const YAML = require('js-yaml');

const FILE_TYPES = { YAML: 'yaml', JSON: 'json' };

class DirectoryFormatter {
    constructor() {
        this._specialPropertyOrder = [];
    }

    /**
     * Format files in a directory
     *
     * @param {String} directory                     - absolute path to a directory with files to format
     * @param {Object} options                       - function options
     * @param {Array} [options.specialPropertyOrder] - list of special properties in the order they should be sorted
     *
     * @returns {Void}
     */
    async formatFiles(directory, options) {
        options = options || {};
        this._specialPropertyOrder = options.specialPropertyOrder || [];

        this._getFilesToFormat(directory).forEach((file) => {
            if (file.includes(`.${FILE_TYPES.JSON}`)) {
                this._formatJSONFile(file);
                return;
            }
            if (file.includes(`.${FILE_TYPES.YAML}`)) {
                this._formatYAMLFile(file);
                return;
            }
            throw new Error(`Unknown file type: ${file}`);
        });
    }

    _formatJSONFile(file) {
        this._writeToFile(
            file,
            JSON.stringify(this._sortObject(JSON.parse(fs.readFileSync(file, 'utf-8'))), null, 2)
        );
    }

    _formatYAMLFile(file) {
        this._writeToFile(
            file,
            YAML.dump(YAML.load(fs.readFileSync(file, 'utf-8'), { sortKeys: this._sortObject, indent: 2 }))
        );
    }

    _getFilesToFormat(directory) {
        return this._getFilesToFormatFromDirectory(directory).concat(
            fs.readdirSync(directory)
                .filter(item => fs.lstatSync(path.resolve(directory, item)).isDirectory())
                .flatMap(item => this._getFilesToFormatFromDirectory(path.resolve(directory, item)))
        );
    }

    _getFilesToFormatFromDirectory(directory) {
        return fs.readdirSync(directory)
            .filter(item => !fs.lstatSync(path.resolve(directory, item)).isDirectory())
            .filter(file => file.includes(`.${FILE_TYPES.JSON}`) || file.includes(`.${FILE_TYPES.YAML}`))
            .map(file => path.resolve(directory, file));
    }

    _sortAlphabetical(a, b) {
        a = a.toLowerCase();
        b = b.toLowerCase();
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    }

    _sortObject(data) {
        if (typeof data === 'object' && !Array.isArray(data)) {
            return Object.keys(data)
                .sort(this._sortAlphabetical.bind(this))
                .sort(this._sortSpecialProperties.bind(this))
                .reduce(
                    (obj, key) => {
                        obj[key] = this._sortObject(data[key]);
                        return obj;
                    },
                    {}
                );
        }
        if (typeof data === 'object' && Array.isArray(data)) {
            data.forEach((_, idx) => {
                data[idx] = this._sortObject(data[idx]);
            });
            return data;
        }
        return data;
    }

    _sortSpecialProperties(a, b) {
        if (this._specialPropertyOrder.includes(a) && this._specialPropertyOrder.includes(b)) {
            return this._specialPropertyOrder.indexOf(a) - this._specialPropertyOrder.indexOf(b);
        }
        if (this._specialPropertyOrder.includes(a)) {
            return -1;
        }
        if (this._specialPropertyOrder.includes(b)) {
            return 1;
        }
        return 0;
    }

    _writeToFile(file, data) {
        fs.writeFileSync(file, data);
    }
}

module.exports = DirectoryFormatter;
