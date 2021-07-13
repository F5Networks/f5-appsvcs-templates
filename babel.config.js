'use strict';

module.exports = {
    sourceType: 'unambiguous',
    presets: [
        ['@babel/preset-env', {
            targets: { node: '4.8.0' },
            useBuiltIns: 'entry',
            corejs: 3
        }]
    ],
    plugins: [
        '@babel/plugin-transform-runtime'
    ],
    ignore: [
        // Add safelisted modules to sped up builds
        '**/lodash/**',
        '**/mustache/**',
        '**/mkdirp/**',
        '**/core-js/**',
        '**/bin/**'
    ]
};
