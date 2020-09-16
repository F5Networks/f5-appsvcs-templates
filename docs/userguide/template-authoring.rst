.. _authoring:

Creating New Templates
======================

Templates are AS3 declarations that have been parameterized.
This page has a short tutorial to help template authors get started creating template sets, with a more detailed explanation of the templates and their syntax.

We recommend template authors read the :ref:`overview` to fully understand how templates are processed in the system.

In order to use the FAST CLI, which provides template validation and previewing, Node Package Manager (npm) must be installed.
FAST CLI is a community-supported authoring tool that template authors may use.
It is installed onto the client PC/laptop, not on BIG-IP, and is used to validate templates as they are being built or modified.

For more information on the npm tool and community, visit `<https://www.npmjs.com/>`_.

Some familiarity with the command line is assumed, and we recommend the FAST npm module (``@f5devcentral/f5-fast-core``) is installed globally.
This provides the FAST command line tools to validate and render templates during authoring.

Help text is provided and accessed via:  ``fast --help``.

For more information on a given command use the ``--help`` flag combined with a command:  ``fast <command> --help``:

.. image:: NPM-Flow.png
   :width: 800

| Use the following command to install the npm module:  ``npm install -g @f5devcentral/f5-fast-core``
| Use the following command to validate your template ``fast validate <filename>``
| Use one of the following commands to zip your template ``zip <zipfile.zip> <sourcefile.mst>`` or  ``fast packageTemplateSet <templateSetPath>``
| Upload and install your zip file using steps 8 and 9 from the example below
|
| For VSCode users, installing the F5 Automated Toolchain Extension helps with managing templates/declarations.
| 1. Download and install the `VSCode Microsoft extension <https://marketplace.visualstudio.com/items?itemName=DumpySquare.vscode-f5-fast>`_
| 2. Once installed, add a device:

* Under the vscode extension settings, press F1, type f5, select "F5: Settings", click add item button, or
* Add device from the F5 HOSTS view. Click F5: Add HOST button in top right of the extension view for "F5 HOSTS" 
* See the `Device Mgmt <https://marketplace.visualstudio.com/items?itemName=DumpySquare.vscode-f5-fast>`_ section for more information.


Hello World example
-------------------

Choose an example AS3 declaration that fits your use case.  See `Example declarations <https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/userguide/examples.html>`_ for AS3 examples.

For our example we are creating a simple Hello World template using `Example 1: Simple HTTP application <https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/userguide/examples.html>`_ then uploading it to FAST.

| This basic declaration creates an HTTP Virtual IP with the following parameters:

* Partition (tenant) named ``Sample_01``
* Application named ``A1``
* Virtual server (HTTP) named ``service``, with a VIP at ``10.0.1.10``
* Pool named ``web_pool`` with 2 members monitored by the default *HTTP* health monitor
* Node IP addresses listed as ``serverAddresses``, ``192.0.1.10`` and ``192.0.1.11``

Later sections go into detail about the template specification and its entire feature set.


1. Create a file named **hello.mst,** then copy the following AS3 declaration into it:

   .. code-block:: json

      {
        "class": "AS3",
        "action": "deploy",
        "persist": true,
        "declaration": {
          "class": "ADC",
          "schemaVersion": "3.0.0",
          "id": "urn:uuid:33045210-3ab8-4636-9b2a-c98d22ab915d",
          "label": "Sample 1",
          "remark": "Simple HTTP application with RR pool",
          "Sample_01": {
             "class": "Tenant",
            "A1": {
              "class": "Application",
              "service": {
                 "class": "Service_HTTP",
                "virtualAddresses": [
                  "10.0.1.10"
                ],
                "pool": "web_pool"
            },
            "web_pool": {
               "class": "Pool",
               "monitors": [
                  "http"
               ],
               "members": [{
                  "servicePort": 80,
                  "serverAddresses": [
                     "192.0.1.10",
                     "192.0.1.11"
                       ]
                    }]
                  }
                }
             }
          }
      }

   

2. Save the file.

3. Parameterization is changing static, hard coded sections to variables that are filled in at deploy time. 

For this example, the following items are changed:

|   Change "Sample_01" to {{tenant_name}} - this will be the AS3 tenant
|   Change "A1" to {{application_name}} - this will be the name of the application
|	  Change the virtualAddresses ip address from "10.0.0.1" to "{{virtual_address}} - this will be the user entered ip address for the virtual address
|   Change the web_pool server_addresses from "10.x.x.x", "10.y.y.y" to {{server_addresses::array}}

.. code-block:: none

      {
        "class": "AS3",
        "action": "deploy",
        "persist": true,
        "declaration": {
          "class": "ADC",
          "schemaVersion": "3.0.0",
          "id": "urn:uuid:33045210-3ab8-4636-9b2a-c98d22ab915d",
          "label": "Sample 1",
          "remark": "Simple HTTP application with RR pool",
          "{{tenant_name}}": {
              "class": "Tenant",
            "{{application_name}}": {
              "class": "Application",
              "service": {
                  "class": "Service_HTTP",
                "virtualAddresses": [
                  "{{virtual_address}}"
                ],
                "pool": "web_pool"
          },
          "web_pool": {
             "class": "Pool",
             "monitors": [
                "http"
             ],
             "members": [{
                "servicePort": 80,
                "serverAddresses": {{server_addresses::array}}
                  }]
                }
              }
            }
          }
      }

Once the declaration is parameterized to fit your needs, it is the template you use to deploy your BIG-IP(s).  

4. If the FAST NPM module is installed globally on your system, we can validate it and try rendering it with the following command:  ``fast validate hello.mst``
5. Create the following file named **params.json**:

   .. code-block:: json

      {
        "tenant_name": "TestTenant",
        "application_name": "MyTestApp",
        "virtual_address": "0.0.0.0",
        "server_addresses": [
          "10.0.0.1",
          "10.0.0.2"
        ]
      }

#. Using this file, the following command will show an example render: ``fast render hello.mst params.json``
#. To add this to the system, the template can be placed into a zip file. From the command line:  ``zip hello.zip hello.mst``
#. Make note of the file location, and the size of the file (in bytes).
   **Note:** file size must be less than 1MB or the transfer fails.
#. Upload the file to the BIG-IP system using cURL from a Linux shell using the following syntax:

   .. code-block:: shell

      $ curl -sku <BIG-IP username>:<BIG-IP password> --data-binary @<path to zip file> -H "Content-Type: application/octet-stream" -H "Content-Range: 0-<content-length minus 1>/<content-length>" -H "Content-Length: <file size in bytes>" -H "Connection: keep-alive" https://<IP address of BIG-IP>/mgmt/shared/file-transfer/uploads/<zipfile-name>.zip

   For example:

   .. code-block:: shell

      $ curl -sku admin:Pass1w0rd! --data-binary @example.zip -H "Content-Type: application/octet-stream" -H "Content-Range: 0-1298/1299" -H "Content-Length: 1299" -H "Connection: keep-alive" https://192.0.2.87/mgmt/shared/file-transfer/uploads/example.zip

   This example returns the following:

   .. code-block:: shell

      {"remainingByteCount":0,"usedChunks":{"0":1299},"totalByteCount":1299,"localFilePath":"/var/config/rest/downloads/example.zip","temporaryFilePath":"/var/config/rest/downloads/tmp/example.zip","generation":0,"lastUpdateMicros":1582756171238125}

   .. _install_template:

#. Install the newly uploaded template set using the following syntax:

   .. code-block:: shell

      curl -sku <BIG-IP username>:<BIG-IP password> -X POST -d '{"name": "<zip file name without .zip extension>"}' -H "Content-Type: application/json" https://<IP address of BIG-IP>/mgmt/shared/fast/templatesets

   For example:

   .. code-block:: shell

      curl -sku admin:Pass1w0rd -X POST -d '{"name": "example"}' -H "Content-Type: application/json" https://192.0.2.87/mgmt/shared/fast/templatesets

   Example response:

   .. code-block:: json

      {
        "code":200,
        "message":""
      }

The template will validate and be added to the system. When navigating to the Deploy tab, the new template set should be available, with the Hello World template ready for use.
The rest of this page explains more about what the templating system can do.
By using JSON schema alongside the templates, FAST provides a powerful system for validating template parameters ensuring applications get deployed as expected.

Template Specification
----------------------

Templates abide by the following rules:

* Templates are text files with sections marked off called variables
* Variables will be marked for replacement at render time
* Variables are surrounded with double curly braces, `{{` and `}}`
* Variables can specify a type: `name`::`type`
* Primitive Types

  * string (default)
  * text (for strings with new lines and escape characters)
  * number
  * integer
  * boolean
  * array

Example
-------

The following is an example of a simple FAST template that will render an AS3 declaration:

.. code-block:: none

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
           "pool": "web_pool_{{port}}"
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


In the example template, we have some variables: tenant_name, application_name, virtual_address, port, and server_addreses. Some have annotations, like `port::integer`.
The `integer` annotation signifies the value of `port` must be an integer.

Variables may be used in multiple places. If a variable is annotated somewhere in the file, an unannotated version of that variable will respect the annotation.

From the variables, a schema is generated.
This schema describes the parameters that must be provided to render the template.
These parameters will show up in the form representation of the template in the GUI.

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

This example 'view' passes validation using the schema:

.. code-block:: json

   {
     "tenant_name" : "myTenant",
     "application_name" : "simple_http_1",
     "virtual_address" : "10.0.0.1",
     "server_addresses" : [ "10.0.1.1", "10.0.2.2" ],
     "port" : 80
   }

This information is collected in the form UI and compiled into a parameter object like the example.
The information is passed along to the template renderer, and the variable names are replaced with their parameter values.

The final declaration is generated by providing the previous view with the provided template:

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
           "pool": "web_pool_80"
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

Extended Types
--------------

Typestache also allows specification of custom types using JSON schema.
Schema files can be placed into **/var/config/rest/iapps/as3-forms-lx/schemas**.
Each file must have a **.json** extension and contain valid JSON schema.
Schemas listed in the `definitions` will be made available to templates using the following syntax:

.. code-block:: none

   name:schema_name:type

* **name** is the name of the variable, as before
* **schema_name** is the name of the JSON schema file, excluding the extension
* **type** is the property name of the definition being referenced

For example:

.. code-block:: none

   ...
   {
     "class": "{{service_type:f5:service}}"
     ...
   }
   ...

AFL has support for `enums` and custom formats can be applied to the primitive types outlined in the previous section.
The variable in the example is a `service` type from the `f5` schema named `service_type`.
The `service` schema is an enum containing the AS3 basic services, `Service_HTTP`, `Service_HTTPS`, `Service_L4`, `Service_UDP`, and `Service_TCP`.

The definition from f5.json:

.. code-block:: json

   {
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
     }
   }

Arrays of primitives should work fine but have not been extensively tested.

Objects are not yet supported.

Up-front validation using the schema will help to prevent failed deployments by notifying the user prior to deployment when a value has an invalid format.
Therefore, when designing a template, the appropriate schema definition should be used for each variable.
For example, if the virtual IP address is a variable, use schema to validate if the input is an IPv4 or IPv6 address.

| For more information on writing schema, see https://json-schema.org/.

.. IMPORTANT::

   When authoring a template, be cautious when entering sensitive data into your template such as passwords, certificates and monitor information to name a few.
   FAST does not encrypt the data and it will remain as plain text.
   Careful consideration should be made when adding this type of data onto the template.

.. _as3_secrets:

AS3 Secrets
-----------

Secrets are things such as passphrases, ssl certificate/keys, etc.
AS3 declarations made for FAST templates should follow best practices for AS3 secrets outside of FAST.

Keeping a Variable Hidden
^^^^^^^^^^^^^^^^^^^^^^^^^

In order to keep a template variable secret, identify it as type: string, format: password.
This will cause the UI to hide characters as they are typed.
When the application is re-deployed, the secret value will return to the same field in the UI, where it can be altered, but not seen.

A schema example showing hidden password text in the GUI:

.. code-block:: yaml

   definitions:
     secret_var:
       title: Secret
       description: This will show up as a password field
       format: password
   template: |
     {{secret_var}}

Keeping Template Text Secret
^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The template may be viewed from the FAST UI via the View Template button located on the :ref:`deploytab` tab.
If there is a static, plain text passphrase in the template, it will be displayed.
For cases where the passphrase is part of an AS3 declaration, the template author may wish to substitute an encrypted passphrase to prevent leaking the password when sharing or backing up the template files.
To obtain the encrypted value, submit the declaration directly to AS3, and retrieve the passphrase object that is returned by AS3 into the FAST template.

For example, if the template contains the following certificate definition:

.. code-block:: json

   {
     "webcert": {
     "class": "Certificate",
     "remark": "in practice we recommend using a passphrase",
     "certificate": "-----BEGIN CERTIFICATE-----\nMIICnDCCAgWgAwIBAgIJAJ5n2b0OCEjwMA0GCSqGSIb3DQEBCwUAMGcxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMRQwEgYDVQQKDAtmNV9OZXR3b3JrczEbMBkGA1UEAwwSc2FtcGxlLmV4YW1wbGUubmV0MB4XDTE3MTEyNjE5NTAyNFoXDTE4MDIyNTE5NTAyNFowZzELMAkGA1UEBhMCVVMxEzARBgNVBAgMCldhc2hpbmd0b24xEDAOBgNVBAcMB1NlYXR0bGUxFDASBgNVBAoMC2Y1X05ldHdvcmtzMRswGQYDVQQDDBJzYW1wbGUuZXhhbXBsZS5uZXQwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBALEsuXmSXVQpYjrZPW+WiTBjn491mwZYT7Q92V1HlSBtM6WdWlK1aZN5sovfKtOX7Yrm8xa+e4o/zJ2QYLyyv5O+t2EGN/4qUEjEAPY9mwJdfzRQy6Hyzm84J0QkTuUJ/EjNuPji3D0QJRALUTzu1UqqDCEtiN9OGyXEkh7uvb7BAgMBAAGjUDBOMB0GA1UdDgQWBBSVHPNrGWrjWyZvckQxFYWO59FRFjAfBgNVHSMEGDAWgBSVHPNrGWrjWyZvckQxFYWO59FRFjAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4GBAJeJ9SEckEwPhkXOm+IuqfbUS/RcziifBCTmVyE+Fa/j9pKSYTgiEBNdbJeBEa+gPMlQtbV7Y2dy8TKx/8axVBHiXC5geDML7caxOrAyHYBpnx690xJTh5OIORBBM/a/NvaR+P3CoVebr/NPRh9oRNxnntnqvqD7SW0U3ZPe3tJc\n-----END CERTIFICATE-----",
     "privateKey": "-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-256-CBC,D8FFCE6B255601587CB54EC29B737D31\n\nkv4Fc3Jn0Ujkj0yRjt+gQQfBLSNF2aRLUENXnlr7Xpzqu0Ahr3jS1bAAnd8IWnsR\nyILqVmKsYF2DoHh0tWiEAQ7/y/fe5DTFhK7N4Wml6kp2yVMkP6KC4ssyYPw27kjK\nDBwBZ5O8Ioej08A5sgsLCmglbmtSPHJUn14pQnMTmLOpEtOsu6S+2ibPgSNpdg0b\nCAJNG/KHe+Vkx59qNDyDeKb7FZOlsX30+y67zUq9GQqJEDuysPJ2BUNP0IJXAjst\nFIt1qNoZew+5KDYs7u/lPxcMGTirUhgI84Jy4WcDvSOsP/tKlxj04TbIE3epmSKy\n+TihHkwY7ngIGtcm3Sfqk5jz2RXoj1/Ac3SW8kVTYaOUogBhn7zAq4Wju6Et4hQG\nRGapsJp1aCeZ/a4RCDTxspcKoMaRa97/URQb0hBRGx3DGUhzpmX9zl7JI2Xa5D3R\nmdBXtjLKYJTdIMdd27prBEKhMUpae2rz5Mw4J907wZeBq/wu+zp8LAnecfTe2nGY\nE32x1U7gSEdYOGqnwxsOexb1jKgCa67Nw9TmcMPV8zmH7R9qdvgxAbAtwBl1F9OS\nfcGaC7epf1AjJLtaX7krWmzgASHl28Ynh9lmGMdv+5QYMZvKG0LOg/n3m8uJ6sKy\nIzzvaJswwn0j5P5+czyoV5CvvdCfKnNb+3jUEN8I0PPwjBGKr4B1ojwhogTM248V\nHR69D6TxFVMfGpyJhCPkbGEGbpEpcffpgKuC/mEtMqyDQXJNaV5HO6HgAJ9F1P6v\n5ehHHTMRvzCCFiwndHdlMXUjqSNjww6me6dr6LiAPbejdzhL2vWx1YqebOcwQx3G\n-----END RSA PRIVATE KEY-----",
     "passphrase": {
       "ciphertext": "ZjVmNQ==",
       "protected": "eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0"
     }
   }

The “protected” field (in base64) indicates that the value of “ciphertext” is in plain text.
Literal translation to {"alg":"dir","enc":"none"}.  Submit a declaration containing this definition to AS3.
In the body of the response, you will find:

.. code-block:: json

   {
      "passphrase": {
         "ciphertext": "JE0kbGkkOFpmMi9oMnpYb1VkVjJpbFpHd28vUT09",
          "protected": "eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0="
          "miniJWE": true
       }
   }

In the response, the value of “protected” has changed to indicate SecureVault encryption (literally {"alg":"dir","enc":"f5sv"}), and “ciphertext” is the encrypted secret.
These examples are directly tied to AS3, and works only for protected ciphertext elements in a declaration.

See `Secrets in AS3 Declarations <https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/declaration-purpose-function.html?highlight=secret#secrets-in-as3-declarations>`_ for a more expanded definition of AS3 secrets.
