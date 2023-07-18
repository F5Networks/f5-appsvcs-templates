#!/usr/bin/env node
/*
 * Copyright 2023. F5 Networks, Inc. See End User License Agreement ("EULA") for
 * license terms. Notwithstanding anything to the contrary in the EULA, Licensee
 * may copy and modify this software product for its internal business purposes.
 * Further, Licensee may upload, publish and distribute the modified version of
 * the software product on devcentral.f5.com.
 */

/* eslint import/no-extraneous-dependencies: 0 */

'use strict';

const path = require('path');
const { Command } = require('commander');
const { DirectoryFormatter } = require('@automation-toolchain/f5-appsvcs-utils');

const packageInfo = require('../package.json');

const SPECIAL_PROPERTY_ORDER = ['class', 'id', 'schemaVersion'];

/**
 * Main control function
 *
 * @returns {void}
 */
async function main() {
    const program = new Command();

    program
        .version(packageInfo.version);
    program
        .requiredOption('--directory <path>', 'Specify directory to format', 'templates/examples')
        .action(async (options) => {
            const directoryFormatter = new DirectoryFormatter();
            await directoryFormatter.formatFiles(
                path.resolve(process.cwd(), options.directory),
                { specialPropertyOrder: SPECIAL_PROPERTY_ORDER }
            );
        });

    await program.parseAsync(process.argv);
}

if (require.main === module) {
    main();
}
