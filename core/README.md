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

To install this module run:

```bash
npm install @f5devcentral/f5-fast-core
```

## Usage

### CLI

A command line interface is provided via a `fast` binary.
The help text is provided below and also accessed via `fast --help`:


```
fast <command>

Commands:
  fast validate <file>                                validate given template source file
  fast schema <file>                                  get template parameter schema for given template source file
  fast validateParameters <tmplFile> <parameterFile>  validate supplied template parameters with given template
  fast render <tmplFile> [parameterFile]              render given template file with supplied parameters
  fast validateTemplateSet <templateSetPath>          validate supplied template set
  fast htmlpreview <tmplFile> [parameterFile]         generate a static HTML file with a preview editor to standard out
  fast packageTemplateSet <templateSetPath> [dst]     build a package for a given template set

Options:
  --help     Show help                                                                                         [boolean]
  --version  Show version number                                                                               [boolean]
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

### Module

Below is a basic example for loading a template without any additional type schema:

```javascript
const fast = require('@f5devcentral/f5-fast-core');

const ymldata = `
    view:
      message: Hello!
    definitions:
      body:
        template:
          <body>
            <h1>{{message}}</h1>
          </body>
    template: |
      <html>
        {{> body}}
      </html>
`;

fast.Template.loadYaml(ymldata)
    .then((template) => {
        console.log(template.getViewSchema());
        console.log(template.render({message: "Hello world!"}));
    });
```

In addition to `Template.loadYaml()`, a `Template` can be created from Mustache data using `Template.loadMst()`:

```javascript
const fast = require('@f5devcentral/f5-fast-core');

const mstdata = '{{message}}';

fast.Template.loadMst(ymldata)
    .then((template) => {
        console.log(template.getViewSchema());
        console.log(template.render({message: "Hello world!"}));
    });
```

To support user-defined types, a `SchemaProvider` must be used.
The `FsSchemaProvider` can be used to load schema from disk:

```javascript
const fast = require('@f5devcentral/f5-fast-core');

const templatesPath = '/path/to/templatesdir'; // directory containing types.json
const schemaProvider = new fast.FsSchemaProvider(templatesPath);
const mstdata = '{{virtual_port:types:port}}';

fast.Template.loadMst(mstdata, schemaProvider)
    .then((template) => {
        console.log(template.getViewSchema());
        console.log(template.render({virtual_port: 443});
    });
```

A higher-level API is available for loading templates via `TemplateProvider` classes.
These classes will handle calling the correct load function (`Template.loadYaml()` vs `Template.loadMst()`) and can also handle schemas.
For example, to load "templates sets" (a collection of template source files) from a given directory, the `FsTemplateProvider` class can be used:

```javascript
const fast = require('@f5devcentral/f5-fast-core');

const templatesPath = '/path/to/templatesdir';
const templateProvider = fast.FsTemplateProvider(templatesPath);

templateProvider.fetch('templateSetName/templateName')
    .then((template) => {
        console.log(template.getViewSchema());
        console.log(template.render({
            var: "value",
            boolVar: false
        }));
    });
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

## Copyright

Copyright 2014-2020 F5 Networks Inc.


### F5 Networks Contributor License Agreement

Before you start contributing to any project sponsored by F5 Networks, Inc. (F5) on GitHub, you will need to sign a Contributor License Agreement (CLA).

If you are signing as an individual, we recommend that you talk to your employer (if applicable) before signing the CLA since some employment agreements may have restrictions on your contributions to other projects.
Otherwise by submitting a CLA you represent that you are legally entitled to grant the licenses recited therein.

If your employer has rights to intellectual property that you create, such as your contributions, you represent that you have received permission to make contributions on behalf of that employer, that your employer has waived such rights for your contributions, or that your employer has executed a separate CLA with F5.

If you are signing on behalf of a company, you represent that you are legally entitled to grant the license recited therein.
You represent further that each employee of the entity that submits contributions is authorized to submit such contributions on behalf of the entity pursuant to the CLA.
