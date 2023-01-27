#!/usr/bin/env node
/* Copyright 2022 F5 Networks, Inc.
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

/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const path = require('path');

const casesNames = [];
const testsResults = [];

async function readingTestsData() {
    return new Promise((resolve, reject) => {
        fs.readdir(path.join(process.cwd(), 'perfomance-tests-results/'), (err, files) => {
            if (err) reject(err);
            else {
                files.forEach((file) => {
                    if (file.includes('_results.csv') || file.includes('_metadata.json')) {
                        const caseName = file.split('_')[0];
                        testsResults.push({
                            name: caseName,
                            type: file.includes('_results.csv') ? 'results' : 'metadata',
                            content: fs.readFileSync(path.join(process.cwd(), `perfomance-tests-results/${file}`), { encoding: 'utf8', flag: 'r' })
                        });
                        if (!casesNames.includes(caseName)) {
                            casesNames.push(caseName);
                        }
                    }
                });
            }
            resolve();
        });
    });
}

function generateHtmlPage() {
    // Generate sub-pages for each test case.
    let resultedHtmlPage = '';

    let results;
    let metadata;

    casesNames.forEach((caseName) => {
        results = testsResults.filter(item => item.name === caseName && item.type === 'results')[0].content;
        // Setting tests metadata
        metadata = JSON.parse(testsResults.filter(item => item.name === caseName && item.type === 'metadata')[0].content);
        resultedHtmlPage += `<table><caption style='text-align:top'>Test Case Name: ${caseName}<br/>Settings: numApplications: ${metadata.numApplications} numTenants: ${metadata.numTenants} batchSize: ${metadata.batchSize} </caption>`;

        // Adding table headers data
        resultedHtmlPage += '<tr>';
        results.split('\n')[0].split(',').forEach((headerValue) => {
            resultedHtmlPage += `<th>${headerValue}</th>`;
        });
        resultedHtmlPage += '</tr>';

        results.split('\n').slice(1).filter(n => n).forEach((line) => {
            resultedHtmlPage += '<tr>';
            line.split(',').filter(n => n).forEach((value) => {
                resultedHtmlPage += `<td>${value}</td>`;
            });
            resultedHtmlPage += '</tr>';
        });
        resultedHtmlPage += '</table>';
        resultedHtmlPage += '</br>';
    });

    // Generate main index.html
    const mainPageTemplate = fs.readFileSync(path.join(__dirname, '/perf_tests_index.html'), { encoding: 'utf8', flag: 'r' });
    fs.writeFileSync(path.join(process.cwd(), 'perfomance-tests-results/index.html'), mainPageTemplate.replace('%REPLACE_WITH_HTML%', resultedHtmlPage));
}

async function main() {
    // Reading Perf Tests Results (csv) and Metadata (html)
    await readingTestsData();

    // Generating HTML Pages
    generateHtmlPage();
}

if (require.main === module) {
    main().catch((e) => {
        console.log(e.stack || e.message);
        process.exitCode = 1;
    });
}

module.exports = {
    main
};
