.. _authoring:

Creating New Templates
======================

Templates are AS3 declarations that have been parameterized. This page has a
short tutorial to help template authors get started creating template sets, and
a more detailed explanation of the templates and their syntax.

We recommend template authors read the overview of the FAST Engine
to fully understand how templates are processed in the system.

Some familiarity with the command line is assumed, and we recommend the FAST
@f5devcentral/fast npm module is installed globally. This provides the
command line tools to validate and render templates during authoring.

Use the following command to install the NPM module:  ``npm install -g f5devcentral/fast``

Hello World example
-------------------

In this section, we create a simple Hello World template and upload it to FAST.
Later sections go into detail about the template specification and its
entire feature set.

1. Start by creating a file named **hello.mst** and copy the following parameterized AS3 declaration into it:

    .. code-block:: json

      {
          "class": "ADC",
          "schemaVersion": "3.11.0",
          "{{tenant_name}}": {
            "class": "Tenant",
            "{{application_name}}": {
              "class": "Application",
              "template": "http",
              "serviceMain": {
                "class": "Service_HTTP",
                "virtualAddresses": ["{{virtual_address}}"],
                "pool": "web_pool_{{port}}",
              },
              "web_pool_{{port}}": {
                "class": "Pool",
                "monitors": [
                  "http"
                ],
                "members": [
                  {
                    "servicePort": {{port::integer}},
                    "serverAddresses": {{server_addresses::array}}
                  }
                ]
              }
            }
          }
        }
      }



    This is a basic template that creates an HTTP Virtual IP and allows you to specify
    the Virtual IP and a list of server addresses, and a port to use for both the
    front and back end. The tenant name and application name are also specified by the user.

2. Save the file.

3. If the FAST NPM module is installed globally on your system, we can validate it and try rendering it with the following command:  ``fast validate hello.mst``

4. Create the following file named **params.yml**:

    .. code-block:: yaml

      tenant_name: TestTenant
      application_name: MyTestApp
      virtual_address: 0.0.0.0
      port: 80
      serverAddresses:
        - 10.0.0.1
        - 10.0.0.2

|

5. Using this file, the following command will show an example render: ``fast render hello.mst params.yml``

6. To add this to the system, this template can be placed into a zip file. From the command line:  ``zip hello.zip hello.mst``

7. Make note of the file location, and the size of the file (in bytes).  Note that it must be less than 1MB or the transfer fails.

8. Upload the file to the BIG-IP system using cURL from a Linux shell using the following syntax:
   
   .. code-block:: shell

      $ curl -sku <BIG-IP username>:<BIG-IP password> --data-binary @<path to zip file> -H "Content-Type: application/octet-stream" -H "Content-Range: 0-<content-length minus 1>/<content-length>" -H "Content-Length: <file size in bytes>" -H "Connection: keep-alive" https://<IP address of BIG-IP>/mgmt/shared/file-transfer/uploads/<zipfile-name>.zip

   For example:

   .. code-block:: shell

      $ curl -sku admin:Pass1w0rd! --data-binary @example.zip -H "Content-Type: application/octet-stream" -H "Content-Range: 0-1298/1299" -H "Content-Length: 1299" -H "Connection: keep-alive" https://192.0.2.87/mgmt/shared/file-transfer/uploads/example.zip

   This example returns the following: 
   
   .. code-block:: shell
      
      {"remainingByteCount":0,"usedChunks":{"0":1299},"totalByteCount":1299,"localFilePath":"/var/config/rest/downloads/example.zip","temporaryFilePath":"/var/config/rest/downloads/tmp/example.zip","generation":0,"lastUpdateMicros":1582756171238125}


9. Install the newly uploaded template set using the following syntax:

   .. code-block:: shell

      curl -sku <BIG-IP username>:<BIG-IP password> -X POST -d '{"name": "<zip file name without .zip extension>"}' -H "Content-Type: application/json" https://<IP address of BIG-IP>/mgmt/shared/fast/templatesets

   For example:

   .. code-block:: shell

      curl -sku admin:Pass1w0rd -X POST -d '{"name": "example"}' -H "Content-Type: application/json" https://192.0.2.87/mgmt/shared/fast/templatesets
 
   Example response: ``{"code":200,"message":""}``

|

The template will validate and then be added to the system. When you navigating to the Deploy
tab, the new template set should be available, with the Hello World template ready for use.

The rest of this page explains more about what the templating system can do. By using
JSON schema alongside the templates, FAST provides a powerful system for
validating template parameters and ensuring that applications get deployed as
expected.

Template Specification
----------------------

Templates abide by the following rules:

* Templates are text files with sections marked off called variables
* Variables will be marked for replacement at render time.
* Variables are surrounded with double curly braces, `{{` and `}}`.
* Variables can specify a type: `name`::`type`
* Primitive Types

  * string (default)
  * text (for strings with newlines and escape characters)
  * number
  * integer
  * boolean
  * array

|

Example
-------

The following is an example of a simple FAST template that will render an
AS3 declaration:

.. code-block:: json

    {
        "class": "ADC",
        "schemaVersion": "3.11.0",
        "{{tenant_name}}": {
          "class": "Tenant",
          "{{application_name}}": {
            "class": "Application",
            "template": "http",
            "serviceMain": {
              "class": "Service_HTTP",
              "virtualAddresses": ["{{virtual_address}}"],
              "pool": "web_pool_{{port}}",
            },
            "web_pool_{{port}}": {
              "class": "Pool",
              "monitors": [
                "http"
              ],
              "members": [
                {
                  "servicePort": {{port::integer}},
                  "serverAddresses": {{server_addresses::array}}
                }
              ]
            }
          }
        }
      }
    }


|

In the example template, we have some variables: tenant_name, application_name,
virtual_address, port, and server_addreses. Some have annotations, like `port::integer`.
The `integer` annotation signifies the value of `port` must be an integer.

Variables may be used in multiple places, if a variable is annotated somewhere
in the file, an unannotated version of that variable will respect the annotation.

From the variables, a schema is generated. This schema describes the parameters
that must be provided to render the template. These parameters will show up in
the form representation of the template in the GUI.

The following schema will get auto-generated from the example:

.. code-block:: json

    {
      "properties": {
        "tenant_name" : {
          "type": "string"
        },
        "application_name" : {
          "type": "string"
        },
        "virtual_address" : {
          "type": "string"
        },
        "server_addresses" : {
          "type": "array"
        },
        "port" : {
          "type": "integer"
        },
      }
    }

|

This example 'view' passes validation using the schema:

.. code-block:: json

    {
      "tenant_name" : "myTenant",
      "application_name" : "simple_http_1",
      "virtual_address" : "10.0.0.1",
      "server_addresses" : [ "10.0.1.1", "10.0.2.2" ],
      "port" : 80
    }

|

This information is collected in the form UI, and compiled into a parameter object
like the example. The information is passed along to the template renderer,
and the variable names are replaced with their parameter values.

The final declaration is generated by providing the previous view with the
provided template:

.. code-block:: json

    {
        "class": "ADC",
        "schemaVersion": "3.11.0",
        "myTenant": {
          "class": "Tenant",
          "simple_http_1": {
            "class": "Application",
            "template": "http",
            "serviceMain": {
              "class": "Service_HTTP",
              "virtualAddresses": ["10.0.0.1"],
              "pool": "web_pool_80",
            },
            "web_pool_80": {
              "class": "Pool",
              "monitors": [
                "http"
              ],
              "members": [
                {
                  "servicePort": 80,
                  "serverAddresses": [ "10.0.1.1", "10.0.2.2" ]
                }
              ]
            }
          }
        }
      }
    }

|

Extended Types
--------------

Typestache also allows specification of custom types using JSON schema. Schema
files can be placed into **/var/config/rest/iapps/as3-forms-lx/schemas**. Each
file must have a **.json** extension and contain valid JSON schema. Schemas listed
in the `definitions` will be made available to templates using the following
syntax:

`name`:`schema_name`:`type`

* **name** is the name of the variable, as before
* **schema_name** is the name of the JSON schema file, excluding the extension
* **type** is the property name of the definition being referenced

for example,

.. code-block:: json

  ...
  {
    "class": {{service_type:f5:service}}
    ...
  }
  ...
  
|

AFL has support for `enums` and custom formats can be applied to the primitive
types outlined in the previous section. The variable in the example is a
`service` type from the `f5` schema named `service_type`. The `service` schema
is an enum containing the AS3 basic services, `Service_HTTP`, `Service_HTTPS`,
`Service_L4`, `Service_UDP`, and `Service_TCP`.

The definition from f5.json:

.. code-block:: json

    "service": {
      "type": "string",
      "enum": [
        "Service_HTTP",
        "Service_HTTPS",
        "Service_TCP",
        "Service_UDP",
        "Service_L4"
      ],
      "default": "Service_HTTP"
    },

|

Arrays of primitives should work fine, but has not been tested extensively.

Objects are not supported yet.


.. |br| raw:: html

   <br />