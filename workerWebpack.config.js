'use strict';

const path = require('path');

const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const nodeExternals = require('webpack-node-externals');
const packageDeps = require('./package.json');

module.exports = {
    optimization: {
        runtimeChunk: { name: 'runtime' },
        usedExports: true,
        // runtimeChunk: false,
        providedExports: false,
        concatenateModules: true,
        chunkIds: 'deterministic' // To keep filename consistent between different modes (for example building only)
    },
    target: 'node',
    entry: './nodejs/fastWorker.js',
    // experiments: {
    //     outputModule: true
    // },
    output: {
        filename: 'FASTWorker[name].js',
        path: path.resolve(__dirname, 'nodejs'),
        // the following library* properties may be deprecated in favor of library.*
        // libraryTarget: 'commonjs',
        // // libraryExport: '',
        // library: 'FASTWorker'
        // this requires experiments flag to be on
        library: {
            // name: 'FASTWorker',
            // name: {
            //     root: 'FASTWorker'
            // },
            type: 'commonjs2'
        }
    },
    module: {
        rules: [
            {
                // include: [path.resolve(__dirname, 'nodejs'), path.resolve(__dirname, 'lib'), path.resolve(__dirname, 'node_modules')],
                test: /\.m?js$/,
                resolve: { fullySpecified: false },
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', {
                                // debug: true,
                                targets: { node: '4.8.0' },
                                modules: false,
                                useBuiltIns: false
                                // corejs: '3',
                                // exclude: ['proposal-dynamic-import']
                                // https://github.com/zloirock/core-js/blob/master/docs/2019-03-19-core-js-3-babel-and-a-look-into-the-future.md#Babel
                            }]
                        ],
                        // https://github.com/babel/babel/issues/9853#issuecomment-619587386
                        plugins: [['@babel/plugin-transform-runtime', {
                            corejs: '3',
                            absoluteRuntime: path.dirname(
                                require.resolve('@babel/runtime-corejs3/package.json')
                            )
                        }]],
                        sourceType: 'unambiguous'

                        // https://webpack.js.org/loaders/babel-loader/#exclude-libraries-that-should-not-be-transpiled
                        // exclude: [
                        //     /node_modules\/core-js/
                        // ]
                    }
                }
            }
        ]
    },
    resolve: {
        // modules: [path.resolve(__dirname, 'node_modules')],
        mainFiles: ['index', 'index.js'],
        fallback: {
            child_process: false,
            crypto: false,
            fs: false,
            http: false,
            https: false,
            'original-fs': false,
            process: false,
            path: false,
            vm: false,
            zlib: false
        },
        extensions: ['', '.js', '.jsx']
    },
    plugins: [
        new NodePolyfillPlugin({
            excludeAliases: [
                'crypto',
                'http',
                'https',
                'path',
                'vm',
                'zlib',
                'process',
                'core-js'
            ]
        })
    ],
    externals: [
        nodeExternals({
            allowlist: Object.keys(packageDeps.dependencies).concat(['']),
            importType: 'commonjs'
            // modulesFromFile: {
            //     fileName: path.resolve(__dirname, 'package.json'),
            //     includeInBundle: ['devDependencies'],
            //     excludeFromBundle: ['dependencies']
            // }
        })
    ],
    externalsType: 'commonjs',
    externalsPresets: { node: true }
    // latest error - cannot 
//     Tue, 13 Jul 2021 02:08:47 GMT - severe: [LoaderWorker] '/var/config/rest/iapps/f5-appsvcs-templates/nodejs/FASTWorkermain.js' failed to load JS File into node.js, skipping: Cannot find module '@babel/runtime-corejs3/core-js/array/is-array'
// Tue, 13 Jul 2021 02:08:47 GMT - finest: [LoaderWorker] '/var/config/rest/iapps/f5-appsvcs-templates/nodejs/FASTWorkerruntime.js' is not a worker, skipping
// Tue, 13 Jul 2021 02:08:47 GMT - config: [RestWorker] /shared/appsvcs has started. Name:RestWorker

};
