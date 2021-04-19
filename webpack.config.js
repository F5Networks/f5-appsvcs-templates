'use strict';

var path = require('path');

module.exports = {
    mode: 'production',
    entry: './presentation/app.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'presentation')
    },
    resolve: {
        fallback: {
            buffer: false,
            crypto: false,
            child_process: false,
            fs: false,
            http: false,
            https: false,
            'original-fs': false,
            path: false,
            vm: false,
            url: false,
            util: false,
            zlib: false
        }
    }
};
