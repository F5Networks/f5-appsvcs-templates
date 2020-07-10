.. _overview:

FAST Overview
=============

This section has a summary of FAST's user interface and how to manage applications
using loaded templates as well as a short Overview video.

|video|

.. |video| raw:: html
 
   <iframe width="560" height="315" src="https://www.youtube.com/embed/sAP30rwIubs" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>


FAST Menu Tabs
--------------

When launching FAST, the Applications List tab is selected. If you have never used FAST before
the application list will likely be empty. See the :ref:`deploytab` tab on deploying a new application.

The tabs in the FAST interface:

.. .. image:: fast-menu.png
..  :width: 300
.. :alt: The FAST menu



|

.. list-table::
      :widths: 40 250
      :header-rows: 1

      * - Tab
        - Summary

      * - :ref:`applisttab`
        - A list of AS3 applications currently deployed onto the BIG-IP. In the table, AS3 applications are displayed along with the template they were deployed with, if deployed using a FAST Template. Applications can be modified or deleted from this page.

      * - :ref:`deploytab`
        - This is where you create a new application. Use this tab to choose a template and provide parameters to submit a new application to AS3.

      * - :ref:`templatetab`
        - This is a list of installed templates, along with any applications using them.

      * - :ref:`deploylogtab`
        - The deploy log is a summary of AS3's async task results.

      * - :ref:`apitab`
        - This tab contains documentation on how to use FAST's REST API.

|

.. _applisttab:

Application List
^^^^^^^^^^^^^^^^
Use this tab to view existing FAST/AS3 applications currently deployed on this BIG-IP. 

Each application is identified by its Tenant and Application name. It also shows the Template used to deploy the application.

.. .. image:: application-list.png
..   :width: 300
..   :alt: The application list



On this tab, there are two Action buttons for each application: **Modify Application** and **Delete Application**.

.. .. image:: modify-application.png
..   :width: 300
..   :alt: The application's parameters are recalled for modification



* Clicking **Modify Application** loads the application template form with the values last used to deploy. This enables changing configuration parameters for operations such as adding and removing pool members.  Click **Submit** to redeploy the application.

.. .. image:: delete-result.png
..   :width: 300
..   :alt: The result of deleting an application.



* Clicking **Delete Application** deletes the application from the BIG-IP. 

.. WARNING:: Once you delete an application, there is no easy way to recall an application's deployment parameters

.. _deploytab:

Deploy
^^^^^^

The Deploy tab is where you create new AS3 applications using a FAST template.

.. .. image:: deploy-view.png
..   :width: 300
..   :alt: The deploy view

At the top of the Deploy pane, there is a button for each installed template. 

To open a template, click the template button. The template loads into the interface, with required fields marked by a red asterisk. 

At the bottom of the template, you see the following options for what to do once the template is complete.

.. list-table::
      :widths: 55 240
      :header-rows: 1

      * - Action
        - Summary

      * - View Template
        - Displays the original template text.

      * - View Schema 
        - View the JSON schema of the template.

      * - View Inputs
        - View a list of inputs by field.

      * - View Rendered
        - View a sample of the rendered output of the template.

      * - Submit
        - Submits the application to AS3 for deployment.

Filling out the form with the requested values, and clicking **Submit** will submit
the declaration for deployment. 

.. .. image:: deployed-application.png
  :width: 300
  :alt: The result of a deployed application


After a successful deployment, you can navigate back to the Applications tab to see the application
in the list view.

.. .. image:: deployed-application-list-view.png
  :width: 300
  :alt: The application list showing our new application


.. _templatetab:

Templates
---------

.. .. image:: template-list.png
  :width: 300
  :alt: The application list


The Templates tab shows a list of installed template sets, the templates in each set,
and which applications are deployed using them.

FAST comes pre-installed with base template sets satisfying common use cases, which are identified by the F5 logo.
Included are templates to deploy virtual servers for basic HTTP and HTTPS applications, as well as simple TCP and UDP applications. 

New Templates and Template Sets
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

A template is a parameterized AS3 declaration while a template set is a grouping of templates.

FAST can be extended beyond the included templates. New templates can be self-authored and installed for any AS3 use case. 
Template sets are templates packaged into a single .zip file that can be loaded into the system via the REST API. They may be provided by F5, sourced from the community, or custom written. 
Template sets can be added or removed via the user interface by clicking either the **Add Template Set** or **Remove Template Set** buttons. 

For information on authoring template sets and understanding the template set format, see :ref:`authoring`.

For information on updating, adding and removing template sets, see :ref:`managing-templates`.


.. _deploylogtab:

Deploy Log
----------
The deploy log is a summary of AS3's async task results, newer jobs are nearer to the top. The output includes the Task ID, the Tenant (BIG-IP partition), and the result.

.. _apitab:

API
---
The API tab contains documentation for the F5 Application Services API and SDK.  Use the index in the left pane to find specific information.

.. IMPORTANT:: If you manually modify a FAST tenant outside of FAST via TMSH, GUI, REST API for example, FAST will overwrite those changes the next time the FAST template modifies the tenant. See :ref:`faq` for more information.
