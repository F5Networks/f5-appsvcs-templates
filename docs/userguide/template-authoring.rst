Creating New Templates
======================

Templates are AS3 declarations that have been parameterized. This page has a
short tutorial to help template authors get started creating template sets, and
a more detailed explanation of the templates and their syntax.

It is recommended for template authors to read the overview of the FAST Engine,
to fully understand how templates are processed in the system.

Some familiarity with the command line is assumed, it is recommended the FAST
@f5devcentral/fast npm module is installed globally, this will provide the
command line tools to validate and render templates during authoring.

`npm install -g f5devcentral/fast`

Hello World
-----------

First we'll start by creating a Hello World template and uploading it to FAST.
Later sections will go into detail about the template specification and its
entire feature set.

Start by creating a file, `hello.mst` and copy the following parameterized AS3
declaration into it:

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

This is a basic template that creates an HTTP Virtual IP and allows you to specify
the Virtual IP and a list of server addresses, and a port to use for both the
front and back end. The tenant name and application name are also specified by the user.

Save the file.

If the FAST npm module is installed globally on your system, we can validate it
and try rendering it with the following commands:

`fast validate hello.mst`

Create the following file params.yml:

.. code-block:: yaml
   tenant_name: TestTenant
   application_name: MyTestApp
   virtual_address: 0.0.0.0
   port: 80
   serverAddresses:
    - 10.0.0.1
    - 10.0.0.2
|

Using this file, the following command will show an example render:

`fast render hello.mst params.yml`

To add this to the system, this template can be placed into azip file.

From the command line:

`zip hello.zip hello.mst`


Take note of where the zip was created, and go back to your BIG-IP. Navigate to
the FAST extension and select the 'Templates' tab. At the top is the dialog to
add a new template set. Click 'choose file' and find the zip we just created and
select ok. Now click 'upload'.

The template will validate and be added to the system. When navigating to the deploy
tab, a new template set should be available with the hello template ready for use.

To understand more about what the templating system can do, read on. By using
JSON schema alongside the templates, FAST provides a powerful system for
validating template parameters and ensuring that applications gets deployed as
expected, with no surprises.

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

The example schema can validate the object the admin or upstream caller provides
(also known as a 'view'):

.. code-block:: json

  {
    "tenant_name" : "myTenant",
    "application_name" : "simple_http_1",
    "virtual_address" : "10.0.0.1",
    "server_addresses" : [ "10.0.1.1", "10.0.2.2" ],
    "port" : 80
  }
|

At render time, the view will get translated in the actual view the template
gets rendered with. A couple system variables, `template_name` and `uuid` are
added to be used in templates.

Variables may be used in multiple places, if a variable is annotated somewhere
in the file, an unannotated version of that variable will result in a string
representation of that variable. The view is filled in to provide this behavior.

.. code-block:: json

  {
    "template_name" : "<name of the template being run>",
    "uuid" : "<a uuid id generated by the system at render time>",

    "tenant_name" : "myTenant",
    "application_name" : "simple_http_1",
    "virtual_address" : "10.0.0.1",
    "server_addresses" : "[ \"10.0.1.1\", \"10.0.2.2\" ]",
    "server_addresses::array" : [ "10.0.1.1", "10.0.2.2" ],
    "port" : "80",
    "port::integer" : 80
  }
|

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
files can be placed into `/var/config/rest/iapps/as3-forms-lx/schemas`. Each
file must have a `.json` extension and contain valid JSON schema. Schemas listed
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
