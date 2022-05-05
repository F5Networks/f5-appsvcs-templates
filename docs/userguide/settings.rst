.. _settings:

FAST Settings
=============

Settings is where optional deployment parameters are set.  

Telemetery Streaming
--------------------

| In order for FAST to utilize Telemetry Streaming, it must first be provisioned on the BIG-IP. See `K12111: Provisioning licensed BIG-IP modules <https://support.f5.com/csp/article/K12111>`_.
| The same needs to be done for ASM and/or AFM logs, which can be enabled per deployment, and turned off even if provisioned.
|
| See the `Telemetry Streaming <https://clouddocs.f5.com/products/extensions/f5-telemetry-streaming/latest/event-listener.html>`_ documentation for configuring logging.


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