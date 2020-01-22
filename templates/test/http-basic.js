/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const assert = require('assert').strict;
const { exec } = require('child_process');

const render = '../core/cli.js render http-basic.yml';

describe('http-basic template tests', function () {
    var decl = '';
    it('renders valid JSON', function () {
        exec(render, (err, stdout, stderr) => {
            try {
                decl = JSON.parse(stdout);
                assert.ok(true);
            } catch (e) {
                throw stdout + e;
            }
        });
    });
});
