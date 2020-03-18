# F5 Application Services Templates (FAST) SDK

This module provides a framework for handling templates.

## Features

* Parses Mustache templates and an extended template format (in YAML)
* Generates a view schema from parsed template data
* Supports Mustache partials and sections
* Renders templates with user-provided views
* Validates user-provided views against generated view schema
* Includes a [command line interface](#cli)

## Installation

This module is not currently on NPM, and as such needs to be installed via a file path:

```bash
npm install path/to/fast/core
```

## CLI

A command line interface is provided via a `fast` binary.
The help text is provided below and also accessed via `fast --help`:


```
fast <command>

Commands:
  fast validate <file>                      validate given template file
  fast schema <file>                        get view schema for given template file
  fast validateView <tmplFile> <viewFile>   validate supplied view with given template
  fast render <tmplFile> [viewFile]         render given template file with supplied view

Options:
  --help     Show help                                                              [boolean]
  --version  Show version number                                                    [boolean]
```

For more information on a given command use the `--help` flag combined with a command:

```bash
fast <command> --help
```

The CLI can also be accessed by executing `cli.js`.
For example:

```bash
./cli.js render path/to/template
```

## Development

`npm` commands should be run in the core subdirectory, not at the top-level.
* To check for lint errors run `npm run lint` 
* To run unit tests use `npm test`

Both of these are run as part of the CI pipeline for this repo.

## Documentation

For more information about FAST, see [FAST Documentation](https://clouddocs.f5.com/products/extensions/f5-appsvcs-templates/latest/)

## License

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)
