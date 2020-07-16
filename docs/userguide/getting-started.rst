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

Requirements:

* BIG-IP v13.1 or later.
* AS3 v3.16 or later must be installed (see |installas3|)

#. Download the FAST extension RPM `from GitHub <https://github.com/F5networks/f5-appsvcs-templates>`_ to a location accessible from the BIG-IP.
#. From the BIG-IP management GUI, install the extension by navigating to **iApps > Package Management LX**.
   Click **Import** and then select the RPM you downloaded.
   Once the package is imported, **f5-appsvcs-templates** will appear in the list of installed extensions.

   .. NOTE::

      On BIG-IP versions prior to 14.0, the iApps LX framework must be enabled before the Configuration utility is visible.
      To do this, run the following command on the BIG-IP: ``touch /var/config/rest/iapps/enable``.
      This command only needs to be run once (per BIG-IP system).
      This is not necessary with BIG-IP 14.0 and later.

Usage Quick Start
-----------------

#. The extension's UI can be found by navigating to **iApps > Application Services > Applications LX**
#. Click **F5 Application Services Templates** to start using FAST.
   There is a navigation menu at the top, and the initial tab displays a list of FAST applications on the BIG-IP, which will likely be empty on a fresh installation.
#. To create an application, first click on the Deploy tab.
   This will display a list of available templates that are ready to deploy.
#. Click one of the template names, fill out the required fields, and then click **Submit**.
#. Upon successful submission, the page will redirect to the Deploy Log, where there current status of the deploy action can be seen.
#. After the task is successful, return to the Applications tab to see the deployed application.
   From here the application can be modified or deleted.

   .. NOTE::

      Modifying FAST applications outside of FAST (e.g., via TMSH or with AS3 declarations) can result in those changes getting overwritten the next time FAST modifies the application.
      See :ref:`faq` for more information.

Next Steps
----------

Continue with :ref:`Fast Overview<overview>` for information on using the interface, or use the left navigation to go to a specific page.

.. |installas3| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/userguide/installation.html" target="_blank">Downloading and Installing AS3</a>
