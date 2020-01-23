'use strict';

module.exports = {
    presets: [
        ['@babel/preset-env', {
            targets: { node: '4.8.0' }
        }]
    ],
    ignore: [
        '*/avj/*'
    ]
};
