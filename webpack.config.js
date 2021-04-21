'use strict';

const path = require('path');

const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

module.exports = {
    entry: './presentation/app.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'presentation')
    },
    resolve: {
        fallback: {
            child_process: false,
            crypto: false,
            fs: false,
            http: false,
            https: false,
            'original-fs': false,
            path: false,
            vm: false,
            zlib: false
        }
    },
    plugins: [
        new NodePolyfillPlugin({
            excludeAliases: [
                'crypto',
                'http',
                'https',
                'path',
                'vm',
                'zlib'
            ]
        })
    ]
};
