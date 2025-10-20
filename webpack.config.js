'use strict';

const path = require('path');

const webpack = require('webpack');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');

// Capture build-time Node version once so it can be injected for version checks in browser libs
const buildNodeVersion = process.versions && process.versions.node ? process.versions.node : '22.12.0';

module.exports = {
    entry: [
        './presentation/shim.js',
        './presentation/app.js'
    ],
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
                loader: 'vue-loader'
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
            process: require.resolve('process/browser'),
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
            'vue$': 'vue/dist/vue.esm-browser.prod.js'
        }
    },
    plugins: [
        new webpack.ProvidePlugin({ process: 'process/browser' }),
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
        new VueLoaderPlugin(),
        new webpack.DefinePlugin({
            __BUILD_NODE_VERSION__: JSON.stringify(buildNodeVersion),
            __VUE_OPTIONS_API__: JSON.stringify(true),
            __VUE_PROD_DEVTOOLS__: JSON.stringify(false)
        }),
    ]
};
