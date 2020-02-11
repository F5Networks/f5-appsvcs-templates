Getting Started with FAST
=========================
This guide contains information about how to install and use
F5 Application Services Templates.

.. _about:

About F5 Application Services Templates
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

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
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Prerequisites

* BIG-IP, TMOS v13.1 or later.
* AS3 version 3.16 or later must be installed.

See the
`AS3 Documentation <https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/>`_
for more details on AS3.

The FAST extension can be download from github at http://github.com/F5Networks/f5-appsvcs-templates.

Download the RPM onto the machine you will be using to access to BIG-IPs web interface.
From there, install the extension by navigating to iApps > Package Management LX.
Click 'import' and select the RPM downloaded in the previous step.

Once the package is imported, you should now see f5-appsvcs-templates in the list
of installed extensions.

The extension's UI can be found by navigating to
iApps > Application Services > Applications LX

There an entry should be shown for F5 Application Services Templates. Click this
entry to start using FAST. Follow the links on the side to learn more about FAST's features.



.. |declare| raw:: html

   <a href="https://f5.com/about-us/blog/articles/in-container-land-declarative-configuration-is-king-27226" target="_blank">declarative</a>

.. |br| raw:: html

   <br />
