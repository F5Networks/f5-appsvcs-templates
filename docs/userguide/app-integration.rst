.. _app-integration:

App Integration with FAST
=========================

Overview
--------

Integrating FAST technology into other JavaScript projects can be done with the ``@f5devcentral/f5-fast-core`` NPM module.
The ``@f5devcentral/f5-fast-core`` module:

* Parses Mustache templates and an extended template format (in YAML)
* Supports Mustache partials and sections
* Generates a view schema from parsed template data
* Renders templates with user-provided views
* Validates user-provided views against generated view schema
* Includes a command line interface


Installation
------------

The ``@f5devcentral/f5-fast-core`` module can be installed from NPM via:

.. code-block:: shell

   npm install @f5devcentral/f5-fast-core

Example Usage
-------------

Below is a basic example for loading a template without any additional type schema:

.. code-block:: javascript

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

In addition to ``Template.loadYaml()``, a ``Template`` can be created from Mustache data using ``Template.loadMst()``:

.. code-block:: javascript

   const fast = require('@f5devcentral/f5-fast-core');

   const mstdata = '{{message}}';

   fast.Template.loadMst(ymldata)
       .then((template) => {
           console.log(template.getViewSchema());
           console.log(template.render({message: "Hello world!"}));
       });

To support user-defined types, a ``SchemaProvider`` must be used.
The ``FsSchemaProvider`` can be used to load schema from disk:

.. code-block:: javascript

   const fast = require('@f5devcentral/f5-fast-core');

   const templatesPath = '/path/to/templatesdir'; // directory containing types.json
   const schemaProvider = new fast.FsSchemaProvider(templatesPath);
   const mstdata = '{{virtual_port:types:port}}';

   fast.Template.loadMst(mstdata, schemaProvider)
       .then((template) => {
           console.log(template.getViewSchema());
           console.log(template.render({virtual_port: 443});
       });

A higher-level API is available for loading templates via ``TemplateProvider`` classes.
These classes will handle calling the correct load function (``Template.loadYaml()`` vs ``Template.loadMst()``) and can also handle schemas.
For example, to load "templates sets" (a collection of template source files) from a given directory, the ``FsTemplateProvider`` class can be used:

.. code-block:: javascript

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

CLI
---

A command line interface is provided via a ``fast`` binary.
The help text is provided below and also accessed via ``fast --help``:


.. code-block:: shell

   fast <command>

   Commands:
     fast validate <file>                             validate given template source file
     fast schema <file>                               get template parameter schema for given template source file
     fast validateView <tmplFile> <parameterFile>     validate supplied template parameters with given template
     fast render <tmplFile> [parameterFile]           render given template file with supplied parameters
     fast validateTemplateSet <templateSetPath>       validate supplied template set
     fast htmlpreview <tmplFile> [parameterFile]      generate a static HTML file with a preview editor to standard out
     fast packageTemplateSet <templateSetPath> [dst]  build a package for a given template set

   Options:
     --help     Show help                                                                                         [boolean]
     --version  Show version number                                                                               [boolean]

For more information on a given command use the ``--help`` flag combined with a command:

.. code-block:: shell

   fast <command> --help

The CLI can also be accessed by executing ``cli.js``.
For example:

.. code-block:: shell

   ./cli.js render path/to/template
