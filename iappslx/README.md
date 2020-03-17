# F5 Application Services Templates (FAST) iApps LX package

## Overview

This iApps LX package provides a REST front-end and a GUI for managing and deploying applications via FAST templates.

## Development

`npm` commands should be run in this subdirectory and not the top-level.
Run `npm run lint` to check for lint errors and `npm test` to run unit tests.
Both of these are run as part of the CI pipeline for this repo.

## Building

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
The package can be installed to a BIG-IP using the usual mechanisms for installing iApp LX packages.
There is also an `install-rpm` script provided in `../scripts` that installs the latest RPM found in `dist` to a target BIG-IP via the REST API.

## Logging

All log messages should contain the worker name (TemplateWorker) for easier filtering.

The following logging levels are used (from low priority to high):

* fine - lower priority informational messages
* info - higher priority informational messages
* error - recoverable error (e.g., bad requests)
* severe - unrecoverable error

A `finest` is also available, but already gets spammed with a lot of socket information, which makes it a common log level to disable.

All requests and responses are logged at a `fine` log level by default.
Any response that contains an error status code (>=400) will default to an `error`.

## License

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)
