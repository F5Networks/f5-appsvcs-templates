'use strict';

const path = require('path');

const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');

module.exports = {
    entry: './presentation/app.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'presentation')
    },
    module: {
        rules: [
            {
                test: /\.vue$/,
                loader: 'vue-loader'
            }
        ]
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
        }),
        new VueLoaderPlugin()
    ]
};
