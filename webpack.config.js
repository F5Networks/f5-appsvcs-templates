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
    stats: {
        colors: true,
        modules: true,
        reasons: true,
        errorDetails: true
    },
    module: {
        rules: [
            {
                test: /\.vue$/,
                loader: 'vue-loader',
                options: {
                    compilerOptions: {
                        compatConfig: {
                            MODE: 2
                        }
                    }
                }
            },
            {
                test: /\.css$/,
                use: [
                    'vue-style-loader',
                    'css-loader'
                ]
            }
        ]
    },
    resolve: {
        fallback: {
            child_process: false,
            crypto: false,
            dgram: false,
            fs: false,
            http: false,
            https: false,
            'original-fs': false,
            path: false,
            vm: false,
            zlib: false
        },
        alias: {
            // 'vue$': 'vue/dist/vue.esm.js',
            'vue$': 'vue/dist/vue.esm-bundler.js',
            'vue': '@vue/compat'
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
