.. _quick:

Getting Started
===============
This guide contains information about how to install and use F5 Application Services Templates.

.. _about:

About F5 Application Services Templates
---------------------------------------

The F5 Application Services Templates extension, or FAST, provides a way to streamline deployment of applications on BIG-IP using templatized AS3 declarations.

AS3 applications deployed through FAST can be managed using FAST.
FAST auto-generates web forms custom to your templates for creating and modifying applications, and provides visibility into what FAST applications are configured on your BIG-IP.

The extension comes with a base set of templates for common use cases such as TCP or HTTPS.
New templates can be created to satisfy specific needs of any infrastructure.

Installation
------------

See :ref:`Install / Uninstall<install>` for installation instructions.

.. NOTE:: On BIG-IP versions prior to 14.0, the iApps LX framework must be enabled before the Configuration utility is visible. 
      To do this, run the following command on the BIG-IP: ``touch /var/config/rest/iapps/enable``.
      This command only needs to be run once (per BIG-IP system).
      This is not necessary with BIG-IP 14.0 and later.

Usage Quick Start
-----------------

#. The extension's UI can be found by navigating to **iApps > Application Services > Applications LX**
#. Click **F5 Application Services Templates** to start using FAST.
   There is a navigation menu at the top, and the initial tab displays a list of FAST applications on the BIG-IP, which will likely be empty on a fresh installation.
#. To create an application, first click the FAST Templates tab to display a list of available templates that are ready to deploy.
#. Click one of the template names, fill out the required fields, and then click **Deploy**.
#. Upon submission, the page will redirect to the History tab, where there current status of the deploy action can be seen.
#. After the deployment is successful, select to the Applications tab to see the deployed application.
   From here the application can be modified or deleted.

.. WARNING::  We strongly recommend **not** using both FAST AND iApp templates together as these templating solutions are incompatible with each other. Using both FAST and iApps is likely to create configuration and source-of-truth conflicts, resulting in an undesirable end-state. 

.. NOTE:: Modifying FAST applications outside of FAST (e.g., via TMSH or with AS3 declarations) can result in those changes getting overwritten the next time FAST modifies the application.
         See :ref:`faq` for more information.

Next Steps
----------

Continue with :ref:`GUI Overview<overview>` for information on using the interface, or use the left navigation to go to a specific page.
