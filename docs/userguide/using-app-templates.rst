.. _overview:

GUI Overview
============

This section has a summary of F5 BIG-IP FAST's user interface and how to manage applications
using loaded templates as well as a short Overview video.

|video|

.. |video| raw:: html
 
   <iframe width="560" height="315" src="https://www.youtube.com/embed/sAP30rwIubs" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>


BIG-IP FAST Menu Tabs
---------------------

When launching BIG-IP FAST, the **FAST Templates** tab is selected. 
The page is divided into 2 sections: *bigip-fast-templates* and *examples*.
If new template sets are added in the future, those will be displayed here as well. 
See `Creating New Templates <https://clouddocs.f5.com/products/extensions/f5-appsvcs-templates/latest/userguide/template-authoring.html>`_ for information on creating templates sets.

The tabs in the BIG-IP FAST interface:

.. .. image:: fast-menu.png
..  :width: 300
.. :alt: The BIG-IP FAST menu


.. list-table::
      :widths: 40 250
      :header-rows: 1

      * - Tab
        - Summary

      * - :ref:`deploytab`
        - This is where you create a new application. Use this tab to choose a template and provide parameters to submit a new application to AS3.

      * - :ref:`applisttab`
        - A list of BIG-IP AS3 applications currently deployed onto the BIG-IP. In the table, BIG-IP AS3 applications are displayed along with the template they were deployed with, if deployed using a BIG-IP FAST Template. Applications can be modified or deleted from this page.

      * - :ref:`historytab`
        - This is a list of installed templates, along with any applications using them and timestamp information.

      * - :ref:`settingstab`
        - Settings is where optional deployment parameters are set.

      * - :ref:`apitab`
        - This tab contains documentation on how to use BIG-IP FAST's REST API.

Expanded definitions the BIG-IP FAST Menu tabs are below.


.. _deploytab:

BIG-IP FAST Templates
^^^^^^^^^^^^^^^^^^^^^

The BIG-IP FAST Templates tab is where you create new BIG-IP AS3 applications using a BIG-IP FAST template.

.. .. image:: deploy-view.png
..   :width: 300
..   :alt: The deploy view

To open a template, click the template name. The template loads into the interface, with required fields marked by a red asterisk. 

The template displays the following buttons for what to do once the template is complete.

.. list-table::
      :widths: 55 240
      :header-rows: 1

      * - Action
        - Summary

      * - Deploy
        - Submits the application to AS3 for deployment.

      * - Cancel
        - Cancels the application returning to the template list.

      * - Debug View
        - Opens a panel of option buttons to view template text, JSON schema, inputs and sample rendered output.

      * - View Template
        - Displays the original template text.

      * - View Schema 
        - View the JSON schema of the template.

      * - View Inputs
        - View a list of inputs by field.

      * - View Rendered
        - View a sample of the rendered output of the template.


Filling out the form with the requested values, and clicking **Deploy** will submit the declaration for deployment. 

.. .. image:: deployed-application.png
  :width: 300
  :alt: The result of a deployed application

After a successful deployment, you can navigate to the Applications tab to see the application in the list view.

.. .. image:: deployed-application-list-view.png
  :width: 300
  :alt: The application list showing our new application


New Templates and Template Sets
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

A template is a parameterized AS3 declaration while a template set is a grouping of templates.

BIG-IP FAST can be extended beyond the included templates. New templates can be self-authored and installed for any AS3 use case. 
Template sets are templates packaged into a single .zip file that can be loaded into the system via the REST API. They may be provided by F5, sourced from the community, or custom written. 
Template sets can be added or removed via the user interface by clicking either the **Add Template Set** or **Remove** buttons. 

.. seealso:: :ref:`authoring` for information on authoring template sets and understanding the template set format. :ref:`managing-templates` for information on updating, adding and removing template sets. :ref:`temp-list` for a list of BIG-IP FAST installed templates.

.. _applisttab:

Applications
^^^^^^^^^^^^
Use this tab to view existing BIG-IP FAST/BIG-IP AS3 applications currently deployed on this BIG-IP. 

Each application is identified by its Tenant and Application name. It also shows the Template used to deploy the application.

.. .. image:: application-list.png
..   :width: 300
..   :alt: The application list


On this tab, the application can be deleted or modified. 

* To Delete one, or multiple applications, check the box next to the application(s) and press **Delete**. A confirmation dialog will display with the options to **Cancel** or **Continue** the deletion.

.. .. image:: modify-application.png
..   :width: 300
..   :alt: The application's parameters are recalled for modification

* Clicking the template name loads the application template form with the values last used to deploy. This enables changing configuration parameters for operations such as adding and removing pool members.  Click **Deploy** to redeploy the application.

.. .. image:: delete-result.png
..   :width: 300
..   :alt: The result of deleting an application.


.. WARNING:: Once you delete an application, there is no easy way to recall an application's deployment parameters


.. _historytab:

History
-------

The History tab displays a list of deployments. 
The list is a summary of AS3's async task results with newer jobs nearer to the top. 
The information includes:

* Application name - the name given to the application 
* Template used  - the name of the template used for deployment including the template set and template name
* Tenant - the name of the deployed tenant
* Operation 

  * Create operation shows the initial deployment
  * Update operation shows any updates to the application in order of deployment
  * Delete
  * Delete All

* Status

  * In Progress - application deployment is processing
  * Success - deployment succeeded
  * No Change
  * Error - See Info column
  * Declaration is Invalid - See Info column
  * Declaration Failed - See Info column
  
* App Template - allows for eding and resubmitting of the template
* Timestamp - the date and time of deployment

* Info - displays information such as a reason for an invalid declaration.

  * invalid: failed AS3 schema validation (e.g., undefined /Tenant01/Application01/Application01_pool/members: should be array)
  * failed: passed validation but still failed to apply (e.g.,  ip addr conflict)
  * error: generic error from AS3

.. .. image:: template-list.png
  :width: 300
  :alt: The application list


.. _settingstab:

Settings
--------
Settings is where optional deployment parameters are set. See `FAST Settings <https://clouddocs.f5.com/products/extensions/f5-appsvcs-templates/latest/userguide/settings.html>`_ for a list of currently supported optional deployment settings.

.. _apitab:

API
---
The API tab contains documentation for the F5 Application Services API and SDK.  Use the index in the left pane to find specific information.

.. IMPORTANT:: If you manually modify a BIG-IP FAST tenant outside of BIG-IP FAST via TMSH, GUI, REST API for example, BIG-IP FAST will overwrite those changes the next time the BIG-IP FAST template modifies the tenant. See :ref:`faq` for more information.
