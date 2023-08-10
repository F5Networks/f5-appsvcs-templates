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
/* eslint-disable no-plusplus */
/* eslint-disable quotes */

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
    let buildChartPage = '';
    let tempChartPage = '';

    let results;
    let metadata;
    let i = 1;

    casesNames.forEach((caseName) => {
        results = testsResults.filter(item => item.name === caseName && item.type === 'results')[0].content;
        // Setting tests metadata
        metadata = JSON.parse(testsResults.filter(item => item.name === caseName && item.type === 'metadata')[0].content);
        resultedHtmlPage += `<table><caption style='text-align:top'>Test Case Name: ${caseName}<br/>Settings: numApplications: ${metadata.numApplications} numTenants: ${metadata.numTenants} batchSize: ${metadata.batchSize} </caption>`;
        buildChartPage += `        var data${i} = google.visualization.arrayToDataTable([\n`;
        buildChartPage += `          ['Batch', '${caseName}'],\n`;
        // Adding table headers data
        resultedHtmlPage += '<tr>';
        results.split('\n')[0].split(',').forEach((headerValue) => {
            resultedHtmlPage += `<th>${headerValue}</th>`;
        });
        resultedHtmlPage += '</tr>';

        results.split('\n').slice(1).filter(n => n).forEach((line) => {
            resultedHtmlPage += '<tr>';
            buildChartPage += '          [';
            line.split(',').filter(n => n).forEach((value) => {
                resultedHtmlPage += `<td>${value}</td>`;
            });
            line.split(',').slice(0, 1).filter(n => n).forEach((value) => {
                const batch = Number(value) + 1;
                buildChartPage += `'${batch}',`;
            });
            line.split(',').slice(2, 3).filter(n => n).forEach((value) => {
                buildChartPage += `${value}`;
            });
            resultedHtmlPage += '</tr>';
            buildChartPage += `],\n`;
        });
        resultedHtmlPage += '</table>';
        resultedHtmlPage += '</br>';
        buildChartPage += `        ]);\n`;
        buildChartPage += `        var options${i} = {\n`;
        buildChartPage += `          title: 'Settings: numApplications: ${metadata.numApplications} numTenants: ${metadata.numTenants} batchSize: ${metadata.batchSize}',\n`;
        buildChartPage += `          curveType: 'function',\n`;
        buildChartPage += `          legend: { position: 'right' },\n`;
        buildChartPage += `          hAxis: {\n`;
        buildChartPage += `          title: 'Batch Run'\n`;
        buildChartPage += `          },\n`;
        buildChartPage += `          vAxis: {\n`;
        buildChartPage += `          title: 'Run Duration'\n`;
        buildChartPage += `          },\n`;
        buildChartPage += `          lineWidth: 4,\n`;
        buildChartPage += `          };\n`;
        buildChartPage += `        var chart = new google.visualization.LineChart(document.getElementById('curve_chart${i}'));\n`;
        buildChartPage += `        chart.draw(data${i}, options${i});\n`;
        tempChartPage += `    <div id="curve_chart${i}" style="width: 900px; height: 500px"></div>\n`;
        i++;
    });
    buildChartPage += `}\n`;
    buildChartPage += `    </script>\n`;
    buildChartPage += `  </head>\n`;
    buildChartPage += `  <body>\n`;
    buildChartPage += tempChartPage;
    buildChartPage += `  </body>\n`;
    buildChartPage += `</html>`;

    // Generate main index.html
    const mainPageTemplate = fs.readFileSync(path.join(__dirname, '/perf_tests_index.html'), { encoding: 'utf8', flag: 'r' });
    const mainChartPageTemplate = fs.readFileSync(path.join(__dirname, '/perf_tests_line_charts.html'), { encoding: 'utf8', flag: 'r' });
    fs.writeFileSync(path.join(process.cwd(), 'perfomance-tests-results/index.html'), mainPageTemplate.replace('%REPLACE_WITH_HTML%', resultedHtmlPage));
    fs.writeFileSync(path.join(process.cwd(), 'perfomance-tests-results/charts.html'), mainChartPageTemplate.replace('%REPLACE_WITH_HTML%', buildChartPage));
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
