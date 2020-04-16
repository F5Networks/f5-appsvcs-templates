.. _app-integration:

App Integrtion with FAST 
========================

Installation
------------

The recommended installation of the npm module is globally which sets binaries in your PATH environment variable for use in your shell. |br|
For more in-depth information https://nodejs.org/en/blog/npm/npm-1-0-global-vs-local-installation/ |br|
Use the following command to install the npm module: ``npm install -g @f5devcentral/f5-fast-core``
https://www.npmjs.com/package/@f5devcentral/f5-fast-core

Developer Documents and Tools
-----------------------------

`npm <www.npmjs.com>`_ is the package manager for the Node JavaScript platform.  Along with an online repository for publishing open-source projects, it is a command line utility (cli).  It is the cli FAST utilizes for authoring templates.  
For information about npm, getting started with npm and the community, visit https://docs.npmjs.com/about-npm/

FAST help text is provided below and also accessed via: ``fast --help`` 

To get specific help use the --help flag combined with a command: ``fast <command> --help``


.. list-table::
      :widths: 60 140
      :header-rows: 1

      * - Commands
        - Description

      * - fast validate <file>
        - Validate given template file

      * - fast schema <file> 
        - Get view schema for given template file

      * - fast validateView <tmplFile> <viewFile>
        - Validate supplied view with given template        

      * - fast render <tmplFile> [viewFile]
        - Render given template file with supplied view

      * - fast validateTemplateSet <templateSetPath>
        - Validate supplied template set

      * - fast htmlpreview <tmplFile> [viewFile]    
        - Generate a static HTML file with a preview editor to standard out


When designing a template, the appropriate schema definition should be used for each variable. For example, if the virtual IP address is a variable, use schema to validate the input is an IPv4 or IPv6 address. |br|
For more information on writing schema, see https://json-schema.org/