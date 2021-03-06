.. _troubleshooting:

Troubleshooting FAST
====================

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

The main log for FAST can be found at ``/var/log/restnoded/restnoded.log``.
This log is shared for all iApps LX extensions.
To locate messages specific to FAST, search for lines containing ``FAST Worker``.
Each message from FAST contains a unique request ID of the form ``[<id>]`` to facilitate tracing log messages belonging to a specific request.
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
This is an issue with the underlying BIG-IP framework, and not an issue with FAST.

**More information** |br|
Restjavad may become unstable if the amount of memory required by the daemon exceeds the value allocated for its use. The memory required by the restjavad daemon may grow significantly in system configurations with either a high volume of device statistics collection (AVR provisioning), or a with relatively large number of LTM objects managed by the REST framework (SSL Orchestrator provisioning). The overall system performance is degraded during the continuous restart of the restjavad daemon due to high CPU usage. 

See `Bug ID 894593 <https://cdn.f5.com/product/bugtracker/ID894593.html>`_ and `Bug ID 776393 <https://cdn.f5.com/product/bugtracker/ID776393.html>`_

**Workaround** |br|
Increase the memory allocated for the restjavad daemon (e.g. 2 GB), by running the following commands in a BIG-IP terminal.
 
``tmsh modify sys db restjavad.useextramb value true`` |br|
``tmsh modify sys db provision.extramb value 2048`` |br|
``bigstart restart restjavad``

Module Provision Dependencies
-----------------------------

FAST templates depend on module provisioning, and the deployed configuration will become invalid if the module is de-provisioned.  
In addition, if other applications use the tenant in the invalid module, the tenant will fail to deploy.

To correct this condition:

* Re-provision the module
* Delete the affected FAST applications 
* Re-deploy the FAST template

Known Issues
------------

| All known issues are now on GitHub as Issues for better tracking and visibility.
| See issues with a label of **Known Issue** at `FAST GitHub <https://github.com/F5Networks/f5-appsvcs-templates/issues>`_.


.. |br| raw:: html

   <br />
