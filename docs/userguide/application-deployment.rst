Deploying a FAST Application 
============================

Deploy using the GUI
--------------------

From the BIG-IP, Launch FAST from **iApps > Application Services > Applications LX.**
You will be presented with 4 tabs, select **Deploy.**
Under Available Templates, expand the section containing the template to deploy.  

For this example we are using **examples/simple_udp.** Fields noted with an asterisk * are required.

| 1. Enter a Tenant Name. The *tenant* is the high-level grouping in an AS3 declaration. FAST deploys all configuration for a given tenant in a BIG-IP partition of the same name.
| 2. Enter an Application Name. The *application* is the low-level grouping in an AS3 declaration. FAST deploys all configuration for a given application in a BIG-IP folder within the tenant partition.
| 3. Enter the virtual_port.
| 4. Enter the virtual_address.
| 5. Enter the server_port.
| 6. Enter a server_address for each server. This field is not required.

See the image below for example field entries.

.. image:: Example_template.png
   :width: 800



Clicking on the View Rendered button displays a sample of the rendered output of the template.

.. image:: View_rendered.png
   :width: 350

Deploy using the FAST API
-------------------------

Deploying an application via a REST call, some familiarity with the REST API is assumed and will not be covered.

Method POST 
^^^^^^^^^^^

Before you begin, create the JSON schema file with the configuration needed for the deployment.  
See `Creating New Templates <https://clouddocs.f5.com/products/extensions/f5-appsvcs-templates/latest/userguide/template-authoring.html>`_ for information on creating AS3 declarations and JSON Schema.

Upload the file to the BIG-IP system using cURL from a Linux shell using the following syntax:

   .. code-block:: shell

      $ curl -sku <BIG-IP username>:<BIG-IP password> --data-binary @<path to zip file> -H "Content-Type: application/octet-stream" -H "Content-Range: 0-<content-length minus 1>/<content-length>" -H "Content-Length: <file size in bytes>" -H "Connection: keep-alive" https://<IP address of BIG-IP>/mgmt/shared/file-transfer/uploads/<zipfile-name>.zip


To send your declaration to FAST, use the POST method to the URI.

   .. code-block:: shell

      $ curl -d -X POST https://<IP address of BIG-IP>/mgmt/shared/fast/applications/declare

In addition to deploying a declaration, POST supports more actions, like reporting a previous declaration (useful with remote targets since GET may only have localhost credentials) or returning the index of saved declarations. 
For more information and usage options (including detailed information on actions), see `AS3s Method POST <https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/as3-api.html#post-ref>`_




.. seealso:: :ref:`authoring` for information on authoring template sets and understanding the template set format. :ref:`managing-templates` for information on updating, adding and removing template sets. :ref:`temp-list` for a list of FAST installed templates.