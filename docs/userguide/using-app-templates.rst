.. _overview:

FAST Overview
=============

This section has a summary of FAST's user interface and how to manage applications
using loaded templates.

FAST Menu Tabs
--------------

When using FAST, the Applications tab is selected, but if you have never used FAST before
the application list will likely be empty. See the deploy section on how to
deploy a new application.

You see the following tabs in the FAST interface:

.. .. image:: fast-menu.png
..  :width: 300
.. :alt: The FAST menu



|

.. list-table::
      :widths: 25 250
      :header-rows: 1

      * - Tab
        - Summary

      * - :ref:`applisttab`
        - This is a list of AS3 applications currently deployed to the BIG-IP. In the table, AS3 applications are displayed along with the template they were deployed with (if they were deployed using a FAST Template). Applications can be modified or deleted from this page.

      * - :ref:`deploytab`
        - This is where you create a new application. Use this tab to choose a template and provide parameters to submit a new application to AS3.

      * - :ref:`templatetab`
        - This table has a list of installed templates, with any applications that use them.

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



On this tab, there are two buttons for each application: **Modify** and **Delete**.

.. .. image:: modify-application.png
..   :width: 300
..   :alt: The application's parameters are recalled for modification



* Clicking **Modify** loads the application template form with the values used to last deploy it. This enables changing configuration parameters for operations such as adding and removing pool members.  Click **Submit** to redeploy the application.

.. .. image:: delete-result.png
..   :width: 300
..   :alt: The result of deleting an application.



* Clicking **Delete** deletes the application from the BIG-IP. 

.. WARNING:: Once you delete an application, there is no easy way to recall an application's deployment parameters

|

.. _deploytab:

Deploy
^^^^^^

The Deploy tab is where you create new AS3 applications using a FAST template.

.. .. image:: deploy-view.png
..   :width: 300
..   :alt: The deploy view

At the top of the Deploy pane, there are buttons for each installed template. 

To open a template, click one of the template buttons. The template loads into the interface, with required fields marked with a red asterisk. 

At the bottom of the template, you see the following options for what to do once the template is complete.

.. list-table::
      :widths: 25 250
      :header-rows: 1

      * - Action
        - Summary

      * - Submit
        - Submit this application to AS3 for deployment

      * - Render
        - See a sample of the rendered output of this template

      * - Schema
        - View the JSON schema of this template parameters.

      * - Template
        - Display the original template text.

Filling out the form with the requested values, and hitting 'Submit' will Submit
the declaration for deployment. See the result of the operation by...

.. .. image:: deployed-application.png
  :width: 300
  :alt: The result of a deployed application


After a successful deployment, you can navigate back to the Applications tab and see the application
in the list view.

.. .. image:: deployed-application-list-view.png
  :width: 300
  :alt: The application list showing our new application

|




.. _templatetab:

Templates
---------

.. .. image:: template-list.png
  :width: 300
  :alt: The application list


The Templates tab shows a list of installed template packages and the templates in each,
and which applications are deployed using them.

FAST comes pre-installed with base template sets that satisfy common use cases.
Included are templates to deploy virtual servers for basic HTTP and HTTPS applications, as well as simple TCP and UDP applications.

New Templates
^^^^^^^^^^^^^

FAST can be extended beyond the included templates, new custom templates can be
installed for any AS3 use case. Template
sets are packaged into a single file that can be loaded into the system via
the GUI or the REST API.

.. .. image:: template-list.png
  :width: 300
  :alt: The application list


To add templates, select a properly formatted template set with the file chooser
and click 'upload'. The template set will be validated and loaded, if there are
any errors with template validation they will be reported at this time.

Template sets may be provided by F5, sourced from the community, or may be custom written. For
information on authoring template sets and understanding the template set format,
see :ref:`authoring`.

|

.. _deploylogtab:

Deploy Log
----------
The deploy log is a summary of AS3's async task results, newer jobs are nearer to the top. The output includes the Task ID, the Tenant (BIG-IP partition), and the result.

|

.. _apitab:

API
---
The API tab contains documentation for the F5 Application Services API and SDK.  Use the index in the left pane to find specific information.
