# F5 Application Services Templates (FAST) iApps LX package

## Overview

This iApps LX package provides a REST front-end and a GUI for managing and deploying applications via FAST templates.

## Development

`npm` commands should be run in the iappslx subdirectory, not at the top-level.
* To check for lint errors run `npm run lint` 
* To run unit tests use `npm test`

Both of these are run as part of the CI pipeline for this repo.

## Building

`rpmbuild` is required to build the RPM.
All other dependencies are handled by NPM (make sure to do an `npm install` before trying to build).

To build everything (recommended), run:

```bash
npm run build
```

To build just the GUI layer, run:

```bash
npm run buildgui
```

To build just the RPM package, run:

```bash
npm run buildrpm
```

The built RPM package and associated sha256 hash will be placed in the `dist` directory.
The package can be installed on a BIG-IP using the usual mechanisms for installing iApp LX packages.
There is also an `install-rpm` script provided in `../scripts` that installs the latest RPM found in `dist` to a target BIG-IP via the REST API.

## Logging

All log messages should contain the worker name (FAST Worker) for easier filtering.

The following logging levels are used (from low priority to high):

* fine - lower priority informational messages
* info - higher priority informational messages
* error - recoverable error (e.g., bad requests)
* severe - unrecoverable error

A `finest` is also available, but already gets spammed with a lot of socket information, which makes it a common log level to disable.

All requests and responses are logged at a `fine` log level by default.
Any response that contains an error status code (>=400) will default to an `error`.

## Documentation

For more information about FAST, see [FAST Documentation](https://clouddocs.f5.com/products/extensions/f5-appsvcs-templates/latest/)

## License

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)

## Copyright

Copyright 2014-2020 F5 Networks Inc.


### F5 Networks Contributor License Agreement

Before you start contributing to any project sponsored by F5 Networks, Inc. (F5) on GitHub, you will need to sign a Contributor License Agreement (CLA).

If you are signing as an individual, we recommend that you talk to your employer (if applicable) before signing the CLA since some employment agreements may have restrictions on your contributions to other projects.
Otherwise by submitting a CLA you represent that you are legally entitled to grant the licenses recited therein.

If your employer has rights to intellectual property that you create, such as your contributions, you represent that you have received permission to make contributions on behalf of that employer, that your employer has waived such rights for your contributions, or that your employer has executed a separate CLA with F5.

If you are signing on behalf of a company, you represent that you are legally entitled to grant the license recited therein.
You represent further that each employee of the entity that submits contributions is authorized to submit such contributions on behalf of the entity pursuant to the CLA.
