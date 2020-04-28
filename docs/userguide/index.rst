.. _start:

Getting Started with FAST
=========================
This guide contains information about how to install and use
F5 Application Services Templates.

.. _about:

About F5 Application Services Templates
---------------------------------------

The F5 Application Services Templates extension, or FAST, provides a way to
streamline deployment of AS3 applications onto BIG-IP. By using AS3 deployment
patterns, or templates, configuring BIG-IP can be easier and less error prone.

AS3 applications deployed through FAST can be managed using FAST. FAST
auto-generates web forms custom to your templates for creating and modifying
applications, and provides visibility into what AS3 applications are configured
on your BIG-IP.

The extension comes with a base set of templates for common use cases such as TCP
or HTTPS. These templates can be modified, or new templates can be created to
satisfy specific needs of any infrastructure.

Continue reading to learn more about templating AS3 applications.

Installing the Application Services Templates Extension
-------------------------------------------------------

Prerequisites

* BIG-IP, TMOS v13.1 or later.
* AS3 version 3.16 or later must be installed (see the `AS3 Documentation <https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/>`_ for more details on AS3).

Downloading and installing the FAST Extension
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

1. Download the FAST extension RPM from GitHub at https://github.com/F5networks/f5-appsvcs-templates to a location accessible from the BIG-IP.

2. From the BIG-IP system, install the extension by navigating to **iApps > Package Management LX**. Click **Import** and then select the RPM you downloaded.

   * If you are using a BIG-IP version prior to 14.0, before you can use the Configuration utility, you must enable the framework using the BIG-IP command line. From the CLI, type the following command:  ``touch /var/config/rest/iapps/enable``.  You only need to run this command once (per BIG-IP system). This is not necessary with 14.0 and later. |br| |br|

   Once the package is imported, you should see **f5-appsvcs-templates** in the list of installed extensions.

3. Click **iApps > Application Services > Applications LX**.

4. Click **F5 Application Services Templates** to start using FAST. 

Continue with :ref:`Fast Overview<overview>` for information on using the interface, or use the left navigation to go to a specific page.



.. |br| raw:: html

   <br />
