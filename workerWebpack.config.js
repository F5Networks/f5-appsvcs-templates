'use strict';

const path = require('path');

const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
// const nodeExternals = require('webpack-node-externals');

module.exports = {
    target: 'node',
    entry: './nodejs/fastWorker.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'nodejs'),
        libraryTarget: 'commonjs'
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', {
                                targets: { node: '4.8.0' },
                                useBuiltIns: 'entry',
                                corejs: 3
                            }]
                        ],
                        plugins: ['@babel/plugin-transform-runtime']
                    }
                }
            }
        ]
    },
    // externals: [nodeExternals()],
    // externalsPresets: { node: true },
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
    // externalsType: 'node-commonjs',
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
