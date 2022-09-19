.. _settings:

FAST Settings
=============

Settings is where optional deployment parameters are set.  

F5 BIG-IP Telemetery Streaming
------------------------------

| In order for FAST to utilize F5 BIG-IP Telemetry Streaming (TS), it must first be installed on the BIG-IP. See `Downloading and Installing F5 BIG-IP Telemetry Streaming <https://clouddocs.f5.com/products/extensions/f5-telemetry-streaming/latest/installation.html>`_ for instructions on installing TS.
| Once TS is installed, ASM and/or AFM logging can be enabled (default if provisioned) or disabled per deployment. 
| For instructions on provisioning BIG-IP modules see `K12111: Provisioning licensed BIG-IP modules <https://support.f5.com/csp/article/K12111>`_.
|
*tsIPAddress* is used to configure F5 BIG-IP Telemetry Streaming by allowing the setting of and IP address used to create TS objects.
The IP address will be used in both node and virtual addresses by parameterizing the values.  

For example:

.. code-block:: none

   "fast_svc_addr": {
        "class": "Service_Address",
        "virtualAddress": "{{tsIpAddress}}"
	}

.. code-block:: none

    {
        "name": "fast_telemetry_node",
        "address": "{{tsIpAddress}}"
    }

.. seealso:: `F5 BIG-IP Telemetry Streaming <https://clouddocs.f5.com/products/extensions/f5-telemetry-streaming/latest/event-listener.html>`_ documentation for using TS and configuring logging.


IPAM
----

| In order to view the IPAM section of the FAST templates, the IPAM enable/disable checkbox must be selected (checked). This option is off by default.
| 
| If IPAM is enabled, an IPAM provider **must** be defined to avoid an invalid configuration.
|
| Setting up an IPAM provider when deploying FAST Applications. 
|
| Currently, we only have builtin support for a *“Generic”* service that attempts to be flexible enough to target any arbitrary IPAM service.
| While the *Generic* provider is configurable in FAST, the IPAM template is in an experimental/beta state, meaning it should be used for testing purposes only.
|
1. From the **Settings** tab, click the **+ row** button. *Generic* will be selected by default
2. Name - give the IPAM provider a name. It is used by FAST templates to identify which provider to use for deploying or deleting applications
3. Host - The host is the location of the IPAM provider. For example: **https://ipamexample.com/api/v1**
4. Username - username for accessing the IPAM provider
5. Password - password for accessing the IPAM provider
6. Retrieve URL - the URL to be used to acquire an IP address from the provider via an HTTP POST request. For example: **: {{host}}/nextavailableip**
7. Retrieve Body - the POST payload to use
8. Retrieve Path Query - a JSON Path query to tell FAST where to find the IP address in the payload of the HTTP response to the POST to acquire an address. For example: **.ipv4addrs[0].ipv4addr**
9. Release URL - the URL to be used to release an IP address from the provider via an HTTP POST request and has an extra "address" parameter available. For example: **{{host}}/releaseip**
10. Release Body - the POST payload to use


.. NOTE:: Please report any issues or an RFE on the `FAST GitHub page <https://github.com/F5Networks/f5-appsvcs-templates>`_ > Issues tab, click New Issue.