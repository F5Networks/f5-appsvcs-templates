.. _troubleshooting:

Troubleshooting FAST
====================

Use this section to read about common troubleshooting steps.

FAST general troubleshooting tips
---------------------------------

Restnoded Failure Log

Examine the restnoded failure log at /var/log/restnoded/restnoded.log.  See :ref:`loggingtab` for more information.
Examine the REST response:
	
 * A 400-level response will carry an error message with it
 * If this message is missing, incorrect, or misleading, please let us know by filing an issue on Github.


Template Set Hash

F5 provided templates should not be modified. Template status is verified using a hash algorithm which is accessible from <BIG-IP>/mgmt/shared/fast/info.
The gui has a visual indicator if an F5 provided template has been modified or an update to the RPM has been made. Navigate to **iApps > Package Management LX > Templates** tab.
If a change has been made, an Update button will be present under the Actions column.

View the template set hashes using cURL:

 .. code-block:: shell

  $ curl -sku <BIG-IP username>:<BIG-IP password>  https://<IP address of BIG-IP>/mgmt/shared/fast/info

.. _uninstallingtab:

Uninstalling FAST
-----------------

F5 Applications Services Templates entry remains in the GUI after uninstalling the package from Package Management LX.

To uninstall, and remove, the F5 Applications Services Templates from the GUI the following steps must be completed:

 1. **iApps> Package Management LX** select f5-appsvcs-templates, click **Uninstall**
 2. **iApps> Application Services> Applications LX** select F5 Applications Services Templates, click **Undeploy**
 3. **iApps> Application Services> Applications LX** select F5 Applications Services Templates, click **Delete** then **Yes** to confirm deletion
 
The result should be a Status of *There are no applications listed.*


.. _loggingtab:

Logging
-------

FAST logs to **/var/log/restnoded/restnoded.log** using f5-logger from the framework supporting multiple log levels.

|

Example log entry where the UUID in the square brackets is a unique to each request received by the REST worker. 
You can trace the request through the response sent.

A request ID of 0 is startup:
::

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
  Wed, 15 Apr 2020 20:28:24 GMT - fine: FAST Worker [c4dd5b9d-3057-4e46-8514-94e3b12c8ab5]: received request method=Get; path=/shared/fast/info
  Wed, 15 Apr 2020 20:28:24 GMT - info: FAST Worker [c4dd5b9d-3057-4e46-8514-94e3b12c8ab5]: Entering GET to appsvcs/info
  Wed, 15 Apr 2020 20:28:24 GMT - info: FAST Worker [c4dd5b9d-3057-4e46-8514-94e3b12c8ab5]: Exiting GET to appsvcs/info
  Wed, 15 Apr 2020 20:28:24 GMT - fine: FAST Worker [c4dd5b9d-3057-4e46-8514-94e3b12c8ab5]: GET to appsvcs/info took 5ms to complete
  Wed, 15 Apr 2020 20:28:24 GMT - info: FAST Worker [c4dd5b9d-3057-4e46-8514-94e3b12c8ab5]: Entering gathering template set data
  Wed, 15 Apr 2020 20:28:24 GMT - info: FAST Worker [c4dd5b9d-3057-4e46-8514-94e3b12c8ab5]: Exiting gathering template set data
  Wed, 15 Apr 2020 20:28:24 GMT - fine: FAST Worker [c4dd5b9d-3057-4e46-8514-94e3b12c8ab5]: gathering template set data took 135ms to complete
  Wed, 15 Apr 2020 20:28:24 GMT - fine: FAST Worker [c4dd5b9d-3057-4e46-8514-94e3b12c8ab5]: sending response after 141ms

 {
  "method": "Get",
  "path": "/shared/fast/info",
  "status": 200
 }
      



For audit logs in **/var/log/audit**, no matter your BIG-IP user account name, audit logs show all messages from **admin** and not the specific user name.

