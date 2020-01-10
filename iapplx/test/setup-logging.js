'use strict';

/* eslint-disable */

const origLogFunc = console.log;
let output = '';

beforeEach(function() {
    output = '';
    console.log = (msg) => {
        output += `${msg}\n`;
    };
});

afterEach(function() {
    console.log = origLogFunc;
    if (this.currentTest.state === 'failed') {
        console.log(output);
    }
});
