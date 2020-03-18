# F5 Application Services Templates (FAST) iApps LX package

## Overview

iApps LX package provides a REST front-end and a GUI for managing and deploying applications via FAST templates.

## Development

`npm` commands should be run in the iappslx subdirectory, not at the top-level.
* To check for lint errors run `npm run lint` 
* To run unit tests use `npm test`

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
The package can be installed on a BIG-IP using the usual mechanisms for installing iApp LX packages.
There is also an `install-rpm` script provided in `../scripts` that installs the latest RPM found in `dist` to a target BIG-IP via the REST API.

## License

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)
