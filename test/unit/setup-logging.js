'use strict';

/* eslint-disable */

const origLogFunc = console.log;
let output = '';

beforeEach(function() {
    output = '';
    console.log = (msg) => {
        if (typeof(msg) === 'object') {
            msg = JSON.stringify(msg, null, 2);
        }
        output += `${msg}\n`;
    };
});

afterEach(function() {
    console.log = origLogFunc;
    if (this.currentTest.state === 'failed') {
        console.log(output);
    }
});
