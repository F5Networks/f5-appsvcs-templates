/* Copyright 2021 F5 Networks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const util = require('./util');

const { monitorTests, poolTests, httpTests } = require('./common/tests');

const { getView, getExpected } = require('./common/http_tests');

const view = getView.run();
const expected = getExpected.run();
const template = 'templates/bigip-fast-templates/http.yaml';

describe(template, function () {
    httpTests.run(util, template, view, expected);

    const monitorAttrs = ['monitor_interval', 'monitor_send_string', 'monitor_expected_response'];
    monitorTests.run(util, template, view, expected, monitorAttrs, '/Common/http');
    poolTests.run(util, template, view, expected);

    describe('clean up', function () {
        util.cleanUp();
    });
});

module.exports = { view, expected };
