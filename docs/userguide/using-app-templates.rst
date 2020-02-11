FAST Overview
=============

This section has a summary of FAST's user interface and how to manage applications
using loaded templates.

FAST Menu Tabs
--------------

When first using FAST, navigation tabs will be shown at the top.

.. image:: fast-menu.png
  :width: 300
  :alt: The FAST menu

|

.. list-table::
      :widths: 25 250
      :header-rows: 1

      * - Tab
        - Summary

      * - Applications
        - This is a list of AS3 applications currently deployed to BIG-IP. In the table, AS3 applications are displayed along with the template they were deployed with (if they were deployed using a FAST Template). Applications can be modified or deleted from this page.

      * - Deploy
        - This is where we go to create a new application. A template can be chosen, and parameters provided to submit a new application to AS3.

      * - Templates
        - This table has a list of installed templates, with applications that use them.

      * - API
        - This tab has documentation on how to use FAST's REST API.

The applications tab will be selected, but if you have never used FAST before
the application list will likely be empty. See the deploy section on how to
deploy a new application.

Deploy
------

In this tab, we can create new AS3 applications.

.. image:: deploy-view.png
  :width: 300
  :alt: The deploy view

|

At the top, the list of installed templates is shown to choose from. At the
bottom, we see a few options that we'll get back to.

By clicking one of the template links, the template's form fields will be loaded
into the interface. We now have a few options of what to do if we click one of
the bottom buttons.

.. list-table::
      :widths: 25 250
      :header-rows: 1

      * - Action
        - Summary

      * - Submit
        - Submit this application to AS3

      * - Render
        - See a sample of the rendered output of this template

      * - Schema
        - View the JSON schema of this template parameters.

      * - Template
        - Display the original template text.

Filling out the form with the requested values, and hitting 'Submit' will Submit
the declaration for deployment. See the result of the operation by...

.. image:: deployed-application.png
  :width: 300
  :alt: The result of a deployed application

|

Now, if we navigate back to the applications tab, we will see the application
in the list view. More on that in the following Applications section.

.. image:: deployed-application-list-view.png
  :width: 300
  :alt: The application list showing our new application

|

Applications
------------

When selected, a list of deployed AS3 applications will be shown in the table.
Each application is identified by it's tenant and application name. The
template used to deploy the application is shown as well.

.. image:: application-list.png
  :width: 300
  :alt: The application list

|

From this view, two buttons are shown for each application: Modify and Delete.

.. image:: modify-application.png
  :width: 300
  :alt: The application's parameters are recalled for modification

|

Clicking modify will load the application deploy form with the values used to
last deploy it. This enables changing configuration parameters for operations
such as adding and removing pool members.

.. image:: delete-result.png
  :width: 300
  :alt: The result of deleting an application.

|

Clicking delete will delete the application from the BIG-IP. Be careful, once
deleted there is no easy way to recall an application's deployment parameters!


Templates
---------

.. image:: template-list.png
  :width: 300
  :alt: The application list

|

This view shows a list of installed template packages, the templates in each,
and which applications are deployed using them.

FAST comes pre-installed with base template sets that satisfy common use cases.
Included are templates to deploy virtual servers for

New Templates
^^^^^^^^^^^^^

FAST can be extended beyond the included templates hoever, new templates can be
installed custom to any AS3 use case. Template
sets are packaged up into a single file that can be loaded into the system via
the GUI or the REST API.

.. image:: template-list.png
  :width: 300
  :alt: The application list

|

To add templates, select a properly formatted template set with the file chooser
and click 'upload'. The template set will be validated and loaded, if there are
any errors with template validation they will be reported at this time.

Template sets may be provided by F5, sourced from the community, or may be custom written. For
information on authoring template sets and understanding the template set format,
see the section on Authoring Templates.
