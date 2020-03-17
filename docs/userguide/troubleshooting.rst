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

F5 provided templates should not be modified. Template status is verified using a hash algorithm which is stored in <BIG-IP>/mgmt/shared/fast/info.
The gui has a visual indicator if an F5 provided template has been modified or an update to the RPM has been made. Navigate to **iApps > Package Management LX > Templates** tab.
If a change has been made, an Update button will be present under the Actions column.

View the template set hashes from a Linux shell using cURL:

  .. code-block:: shell

   $ curl -sku <BIG-IP username>:<BIG-IP password>  https://<IP address of BIG-IP>/mgmt/shared/fast/info

.. _loggingtab:

Logging
-------

FAST logs to **/var/log/restnoded/restnoded.log** using f5-logger from the framework. FAST supports multiple log levels. The log entries contain a JSON block for easy search & reporting by external tools.

|

Example log entry

Fri, 13 Mar 2020 17:24:40 GMT - info: TemplateWorker: Loading template sets from disk: [] (skipping: ["bigip-fast-templates","examples","testset"]) |br|
Fri, 13 Mar 2020 17:24:55 GMT - fine: TemplateWorker received request: method=Get; path=/shared/fast/applications; data=null |br|
Fri, 13 Mar 2020 17:24:55 GMT - fine: TemplateWorker sending response:


.. code-block:: json

 {
   "method": "Get",
   "path": "/shared/fast/applications",
   "status": 200,
   "body": [
    {
      "template": "bigip-fast-templates/http",
      "view": {
        "tenant_name": "t1",
        "app_name": "a1",
        "virtual_address": "10.0.0.1",
        "virtual_port": 443,
        "redirect": false,
        "existing_pool": false,
        "pool_port": 8080,
        "load_balancing_mode": "least-connections-member",
        "existing_monitor": false,
        "existing_tls_server": false,
        "tls_cert_name": "/Common/default.crt",
        "tls_key_name": "/Common/default.key",
        "existing_tls_client": false,
        "existing_http_profile": false,
        "existing_acceleration_profile": false,
        "existing_compression_profile": false,
        "existing_multiplex_profile": false,
        "pool_members": [
          "10.0.0.10"
        ]
      },
      "lastModified": "2020-03-12T20:41:00.369Z",
      "tenant": "t1",
      "name": "a1"
    }
 }  
          ]



For audit logs in **/var/log/audit**, no matter your BIG-IP user account name, audit logs show all messages from **admin** and not the specific user name.

.. |br| raw:: html

    <br />

    