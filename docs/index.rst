F5 Application Services Templates (FAST)
======================

Introduction
------------

F5 Application Services Templates make it easier to deploy AS3 Applications.

The FAST Extension provides a toolset for templating and managing AS3 Applications
on BIG-IP.

QuickStart
----------

Requirements:
 * BIG-IP v13.1 or later
 * AS3 v3.16 or later must be installed (`installation instructions<>`)

`Download the FAST Extension Here<>`

Install the extension by navigating to iApps > Package Management LX.
Click 'import' and select the RPM downloaded in the previous step.

Once the package is imported, you should now see f5-appsvcs-templates in the list
of installed extensions.

The extension's UI can be found by navigating to
iApps > Application Services > Applications LX

There an entry should be shown for F5 Application Services Templates. Click this
entry to start using FAST.

The UI will be loaded with a navigation menu at the top, and the list of AS3
applications on the BIG-IP. The application list will likely be empty.

To create an application, navigate to 'deploy'. A list of templates will be shown.
Click on one of the template names to deploy an AS3 application.

Now, when we navigate back to the application list we will see the application
we deployed. Its parameters can be modified or the application can be deleted
from this list.

For more details on using the UI, see `placeholder for ui docs`

Table of Contents
-----------------

Use the following links, the navigation on the left, and/or the Next and
Previous buttons to explore the documentation.

.. toctree::
   :includehidden:
   :glob:

   userguide/index
   userguide/using-app-templates
   userguide/installed-templates
   userguide/fast-engine
   userguide/template-authoring
   refguide/index


.. |video| raw:: html

   <iframe width="560" height="315" src="https://www.youtube.com/embed/NJjcUUtjnJU" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>

.. |relnotes| raw:: html

   <a href=" https://github.com/F5Networks/f5-appsvcs-extension/releases" target="_blank">Release Notes on GitHub</a>

.. |vid| raw:: html

   <iframe width="560" height="315" src="https://www.youtube.com/embed/cMl3AOtMcUo" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>

.. |supportmd| raw:: html

   <a href="https://github.com/F5Networks/f5-appsvcs-extension/blob/master/SUPPORT.md" target="_blank">Support information on GitHub</a>


.. |release| raw:: html

   <a href="https://github.com/F5Networks/f5-appsvcs-extension/releases" target="_blank">GitHub Release</a>
