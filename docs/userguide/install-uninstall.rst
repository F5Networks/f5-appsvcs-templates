.. _install:

Install / Uninstall
===================

The following information will assist in installing and uninstalling FAST on the BIG-IP.


Installation
------------

Requirements:

* BIG-IP v13.1 or later.
* AS3 v3.16 or later must be installed, see  `Downloading and Installing AS3 <https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/userguide/installation.html>`_.

| 1. Download the FAST extension RPM `from GitHub <https://github.com/F5networks/f5-appsvcs-templates>`_

   * Click the **tags** tab
   * Choose the most current version
   * Under the **Assets** section, click the .rpm file, downloading to a location accessible from the BIG-IP
2. From the BIG-IP management GUI, install the extension by navigating to **iApps > Package Management LX**
3. Click **Import** then select the RPM you downloaded
4. Click **Upload**

Once the package is imported, **f5-appsvcs-templates** will appear in the list of installed extensions.

.. NOTE:: On BIG-IP versions prior to 14.0, the iApps LX framework must be enabled before the Configuration utility is visible.
      To do this, run the following command on the BIG-IP: ``touch /var/config/rest/iapps/enable``.
      This command only needs to be run once (per BIG-IP system).
      This is not necessary with BIG-IP 14.0 and later.


Uninstalling FAST
-----------------

To completely uninstall, and remove, the "F5 Applications Services Templates" entry from the GUI, perform the following steps:

#. **iApps> Package Management LX** select f5-appsvcs-templates, click **Uninstall** then **Yes** to confirm
#. **iApps> Application Services> Applications LX** select F5 Applications Services Templates, click **Undeploy**
#. **iApps> Application Services> Applications LX** select F5 Applications Services Templates, click **Delete** then **Yes** to confirm deletion

The result should be a Status of *There are no applications listed*.

.. |installas3| raw:: html

   <a href="https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/userguide/installation.html" target="_blank">Downloading and Installing AS3</a>
