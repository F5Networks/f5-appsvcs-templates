.. _troubleshooting:

Troubleshooting F5 BIG-IP FAST
==============================

Use this section to read about common troubleshooting steps.

Template Set Hash
-----------------

F5 provided template sets should not be modified.
Template set status is verified using a hash, which can be queried with a ``GET`` to ``<BIG-IP address>/mgmt/shared/fast/info``.
The GUI has a visual indicator if an F5 provided template set matches a known hash, good hash value.
To see this indicator, navigate to **iApps > Package Management LX > Templates** tab.

View the template set hashes using cURL:

 .. code-block:: shell

  $ curl -sku <BIG-IP username>:<BIG-IP password>  https://<IP address of BIG-IP>/mgmt/shared/fast/info

Restnoded Log
-------------

The main log for BIG-IP FAST can be found at ``/var/log/restnoded/restnoded.log``.
This log is shared for all iApps LX extensions.
To locate messages specific to BIG-IP FAST, search for lines containing ``FAST Worker``.
Each message from BIG-IP FAST contains a unique request ID of the form ``[<id>]`` to facilitate tracing log messages belonging to a specific request.
A request ID of 0 is used for startup of the extension.

Below is an example log message::

  Wed, 15 Apr 2020 20:28:21 GMT - info: FAST Worker [0]: Entering loading template sets from disk
  Wed, 15 Apr 2020 20:28:23 GMT - info: FAST Worker: Loading template sets from disk: [] (skipping: ["bigip-fast-templates","examples"])
  Wed, 15 Apr 2020 20:28:23 GMT - info: FAST Worker [0]: Exiting loading template sets from disk
  Wed, 15 Apr 2020 20:28:23 GMT - fine: FAST Worker [0]: loading template sets from disk took 2012ms to complete
  Wed, 15 Apr 2020 20:28:23 GMT - info: FAST Worker [0]: Entering ensure FAST is in iApps blocks
  Wed, 15 Apr 2020 20:28:23 GMT - info: FAST Worker [0]: Exiting ensure FAST is in iApps blocks
  Wed, 15 Apr 2020 20:28:23 GMT - fine: FAST Worker [0]: ensure FAST is in iApps blocks took 5ms to complete
  Wed, 15 Apr 2020 20:28:23 GMT - info: FAST Worker [0]: Entering GET to appsvcs/info
  Wed, 15 Apr 2020 20:28:23 GMT - info: FAST Worker [0]: Exiting GET to appsvcs/info
  Wed, 15 Apr 2020 20:28:23 GMT - fine: FAST Worker [0]: GET to appsvcs/info took 55ms to complete
  Wed, 15 Apr 2020 20:28:23 GMT - info: FAST Worker [0]: Entering gathering template set data
  Wed, 15 Apr 2020 20:28:23 GMT - info: FAST Worker [0]: Exiting gathering template set data
  Wed, 15 Apr 2020 20:28:23 GMT - fine: FAST Worker [0]: gathering template set data took 329ms to complete
  Wed, 15 Apr 2020 20:28:24 GMT - fine: FAST Worker [1]: received request method=Get; path=/shared/fast/info
  Wed, 15 Apr 2020 20:28:24 GMT - info: FAST Worker [1]: Entering GET to appsvcs/info
  Wed, 15 Apr 2020 20:28:24 GMT - info: FAST Worker [1]: Exiting GET to appsvcs/info
  Wed, 15 Apr 2020 20:28:24 GMT - fine: FAST Worker [1]: GET to appsvcs/info took 5ms to complete
  Wed, 15 Apr 2020 20:28:24 GMT - info: FAST Worker [1]: Entering gathering template set data
  Wed, 15 Apr 2020 20:28:24 GMT - info: FAST Worker [1]: Exiting gathering template set data
  Wed, 15 Apr 2020 20:28:24 GMT - fine: FAST Worker [1]: gathering template set data took 135ms to complete
  Wed, 15 Apr 2020 20:28:24 GMT - fine: FAST Worker [1]: sending response after 141ms
  {
   "method": "Get",
   "path": "/shared/fast/info",
   "status": 200
  }

Audit Logs
----------

Audit logs can be found at ``/var/log/audit``.
No matter your BIG-IP user account name, audit logs show all messages from ``admin`` and not the specific user name.

Why is my BIG-IP experiencing occasional high CPU usage and slower performance?
-------------------------------------------------------------------------------
If your BIG-IP system seems to be using a relatively high amount of CPU and degraded performance, you may be experiencing a known issue with the **restjavad** daemon. 
This is an issue with the underlying BIG-IP framework, and not an issue with BIG-IP FAST.

**More information** |br|
Restjavad may become unstable if the amount of memory required by the daemon exceeds the value allocated for its use. The memory required by the restjavad daemon may grow significantly in system configurations with either a high volume of device statistics collection (AVR provisioning), or a with relatively large number of LTM objects managed by the REST framework (SSL Orchestrator provisioning). The overall system performance is degraded during the continuous restart of the restjavad daemon due to high CPU usage. 

See `Bug ID 894593 <https://cdn.f5.com/product/bugtracker/ID894593.html>`_ and `Bug ID 776393 <https://cdn.f5.com/product/bugtracker/ID776393.html>`_

**Workaround** |br|
Increase the memory allocated for the restjavad daemon (e.g. 2 GB), by running the following commands in a BIG-IP terminal.
If your device is a member of config-sync group (HA pair), the following commands need to be run on all peers at the same time. 
See Note below.
 
``tmsh modify sys db restjavad.useextramb value true`` |br|
``tmsh modify sys db provision.extramb value 2048`` |br|
``bigstart restart restjavad``

.. NOTE:: If your device is a member of a config-sync group, you must ensure that the provision.extramb value is the same on all units in the synchronization group prior to performing a ConfigSync to avoid a possible outage. See `K31326690: Provisioning the mgmt plane to large and performing a ConfigSync might cause an outage on the peer unit <https://support.f5.com/csp/article/K31326690>`_ for more information.

Module Provision Dependencies
-----------------------------

BIG-IP FAST templates depend on module provisioning, and the deployed configuration will become invalid if the module is de-provisioned.  
In addition, if other applications use the tenant in the invalid module, the tenant will fail to deploy.

To correct this condition:

* Re-provision the module
* Delete the affected BIG-IP FAST applications 
* Re-deploy the BIG-IP FAST template

BIG-IP FAST UI not Updating after Config-sync
---------------------------------------------

Beginning in v1.16.0, BIG-IP FAST checks for a successful config-sync, reloading caches within 1 minute of the check. 
If you are running a BIG-IP FAST version prior to v1.16.0, and the BIG-IP FAST UI is not updating, refer to the instructions below.

BIG-IP FAST stores all config in data-groups, which are synched via device-groups. 
When a BIG-IP FAST app is deployed on device A, the resulting BIG-IP config appears on device B, including the data-groups. 
On device B, BIG-IP FAST has the information it needs, however the BIG-IP FAST UI has not been notified to reload. 

Beginning with BIG-IP FAST version 1.10, a checkbox has been added to the **Settings** tab to **Disable AS3 Declaration Cache**. 
By disabling BIG-IP AS3 caching, BIG-IP FAST uses the most up-to-date declarations from AS3 which can affect the UI updating when config-sync is modifying an AS3 declaration.
Be aware that by checking **Disable AS3 Declaration Cache**, BIG-IP FAST will check more frequently for application state which may slow performance, but solves the config-sync issue. 

Versions prior to 1.10, restarting the restnoded daemon forces a reload and causes all apps to sync in BIG-IP FAST.

To restart the daemon, run the following command in a BIG-IP terminal:

``bigstart restart restnoded``

The restart should only take a few seconds with the BIG-IP having limited REST access to the control plane during the process.

See `K67197865: BIG-IP daemons <https://support.f5.com/csp/article/K67197865>`_ for information on BIG-IP daemons.

BIG-IP FAST Returns 404 After BIG-IP Reboot
-------------------------------------------

Running a BIG-IP VE version 16.1 with limited resources, along with a BIG-IP FAST version prior to 1.16.0, and performing a reboot, may result in the following error::

  {
  "code": 404,
  "message": "",
  "referer": "https://10.1.2.100/iapps/f5-appsvcs-templates/index.html",
  "errorStack": []
  }

The resolution is to upgrade to BIG-IP FAST version 1.16.0 or later.

HTTP Template Health Monitors not Displaying Properly
-----------------------------------------------------

| There are 2 instances where health monitors associated with the HTTP template may not display as expected.
|
| 1. Combining the HTTP template with the FastL4 health monitor may result in the health monitor not displaying correctly. 
| 2. HTTPS monitor may not hide when the BIG-IP FAST generated HTTPS monitor is selected.
|
The resolution is to upgrade to BIG-IP FAST version 1.17.0 or later.

Known Issues
------------

| All known issues are now on GitHub as Issues for better tracking and visibility.
| See issues with a label of **Known Issue** at `BIG-IP FAST GitHub <https://github.com/F5Networks/f5-appsvcs-templates/issues>`_.


.. |br| raw:: html

   <br />
