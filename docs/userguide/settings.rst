.. _settings:

F5 BIG-IP FAST Settings
=======================

Settings is where optional deployment parameters are set.  

F5 BIG-IP Telemetery Streaming
------------------------------

| In order for BIG-IP FAST to utilize F5 BIG-IP Telemetry Streaming (TS), it must first be installed on the BIG-IP. See `Downloading and Installing F5 BIG-IP Telemetry Streaming <https://clouddocs.f5.com/products/extensions/f5-telemetry-streaming/latest/installation.html>`_ for instructions on installing TS.
| Once BIG-IP TS is installed, ASM and/or AFM logging can be enabled (default if provisioned) or disabled per deployment. 
| For instructions on provisioning BIG-IP modules see `K12111: Provisioning licensed BIG-IP modules <https://support.f5.com/csp/article/K12111>`_.
|
*tsIPAddress* is used to configure F5 BIG-IP Telemetry Streaming by allowing the setting of and IP address used to create BIG-IP TS objects.
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

| In order to view the IPAM section of the BIG-IP FAST templates, the IPAM enable/disable checkbox must be selected (checked). This option is off by default.
| 
| If IPAM is enabled, an IPAM provider **must** be defined to avoid an invalid configuration.
|
| Setting up an IPAM provider when deploying BIG-IP FAST Applications. 
|
| Currently, we have built-in support for *Infoblox* IPAM as well as a *Generic* service that attempts to be flexible enough to target any arbitrary IPAM service.
| While the IPAM provider is configurable in BIG-IP FAST, the IPAM template is in an experimental/beta state, meaning it should be used for testing purposes only.
|
| From the **Settings** tab, click the **+ row** button. *Infoblox* will be selected by default
| The following settings are available for the *Infoblox* IPAM provider - 
1. Name - give the IPAM provider a name. It is used by BIG-IP FAST templates to identify which provider to use for deploying or deleting applications
2. Host - The host is the location of the IPAM provider. For example: **https://ipamexample.com/api/v1**
3. Username - username for accessing the IPAM provider
4. Password - password for accessing the IPAM provider
5. API Version - the Infoblox IPAM API version. This defaults to v2.4 as that is the version BIG-IP FAST has been tested with.
6. Network Name - this is the name of the network from which you want to assign IPs in the IPAM provider. Please note that this is the name according to the API and not the common name in the IPAM frontend. For example: **ZG5zLm5ldDdvcmskKJHuNTAuMTAuGF8yNCf5:10.5.1.0/24/default**

| If you select the *Generic* IPAM provider, the following settings are available - 
1. Name - give the IPAM provider a name. It is used by BIG-IP FAST templates to identify which provider to use for deploying or deleting applications
2. Host - The host is the location of the IPAM provider. For example: **https://ipamexample.com/api/v1**
3. Username - username for accessing the IPAM provider
4. Password - password for accessing the IPAM provider
5. Retrieve URL - the URL to be used to acquire an IP address from the provider via an HTTP POST request. For example: **: {{host}}/nextavailableip**
6. Retrieve Body - the POST payload to use
7. Retrieve Path Query - a JSON Path query to tell BIG-IP FAST where to find the IP address in the payload of the HTTP response to the POST to acquire an address. For example: **$.ipv4addrs[0].ipv4addr**
8. Retrieve Reference Path Query - a JSON Path query to tell BIG-IP FAST where to find the IPAM reference to the IP address in the above HTTP response. This lets BIG-IP FAST request the IPAM provider to release the IP when it is no longer needed. For example: **$.id**
9. Release URL - the URL to be used to release an IP address from the provider via an HTTP POST request and has an extra "address" parameter available. For example: **{{host}}/releaseip**
10. Release Body - the POST payload BIG-IP FAST will use to request the release of the IP address from the IPAM provider.
11. Release Method - this allows you to set the HTTP Method used by your IPAM to release the IP. Defaults to **POST**.
12. Authorization Header Name - In case the user doesn't setup a username and password to access the IPAM provider, they can also setup using an authorization header. The name of the auth header will be specified here. For example: **token** or **Authorization**
13. Authorization Header Value - This specifies the actual value to use for the authorization header. For example: **Basic YWRtaW46cGFzc3dvcmQ=**


.. NOTE:: Please report any issues or an RFE on the `BIG-IP FAST GitHub page <https://github.com/F5Networks/f5-appsvcs-templates>`_ > Issues tab, click New Issue.