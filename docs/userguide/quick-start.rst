.. _quick:

Quick Start
-----------
Use this section to quickly get started using FAST templates.  For more details, see :ref:`start`.

Requirements:

* BIG-IP v13.1 or later
* AS3 v3.16 or later must be installed (see |installas3|)

Use the following procedure to get started with FAST 

1. Download the FAST Extension (https://github.com/F5devcentral/f5-appsvcs-templates) to a location accessible from the BIG-IP.

2. From the BIG-IP system, install the extension by navigating to **iApps > Package Management LX**. Click **Import** and then select the RPM you downloaded.

.. NOTE:: If you are using a BIG-IP version prior to 14.0, before you can use the Configuration utility, you must enable the framework using the BIG-IP command line. From the CLI, type the following command:  ``touch /var/config/rest/iapps/enable``.  You only need to run this command once (per BIG-IP system). This is not necessary with 14.0 and later.

3. Once the package is imported, you should now see f5-appsvcs-templates in the list of installed extensions.

4. The extension's UI can be found by navigating to **iApps > Application Services > Applications LX**

5. Click **F5 Application Services Templates** to start using FAST. |br| You will see a navigation menu at the top, and the list of AS3 applications on the BIG-IP (which will likely be empty on initial installation).

6. To create an application, click the Deploy tab. A list of available templates displays.

7. Click one of the template names, fill out the required fields, and then click **Submit** to deploy an AS3 application.

When you click the Application List tab, you will see the application you just deployed. From the Application List tab, you can modify the parameters or delete the application
from this list.

.. IMPORTANT:: If you manually modify a FAST tenant outside of FAST via TMSH, GUI, REST API for example, FAST will overwrite those changes the next time the FAST template modifies the tenant. See :ref:`faq` for more information.

For more details on using the UI, see :ref:`start`.


.. |installas3| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/userguide/installation.html" target="_blank">Downloading and Installing AS3</a>

.. |br| raw:: html

   <br />


