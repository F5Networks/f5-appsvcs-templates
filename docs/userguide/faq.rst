.. _faq:

Frequently Asked Questions (FAQ)
================================

What is F5 BIG-IP FAST (F5 BIG-IP Application Services Templates)?
------------------------------------------------------------------

The F5 BIG-IP Application Services Templates extension, or BIG-IP FAST, provides a way to streamline deployment of applications on BIG-IP using templatized AS3 declarations.

BIG-IP FAST is:

* A flexible and powerful templating system
* An effective way to deploy applications on the BIG-IP system using AS3
* A cross-platform successor to iApp templates, built on top of our declarative APIs
* Seamless integration and insertion into CI/CD pipelines
* Compatibility with modern development languages like Node.js and Python

See :ref:`about` for a more in-depth description of BIG-IP FAST.

Do BIG-IP FAST templates utilize BIG-IP AS3?
--------------------------------------------

BIG-IP FAST uses BIG-IP AS3 declarations to deploy applications and tenants.
The declarative API represents the configuration which BIG-IP AS3 is responsible for creating on a BIG-IP system.
Therefore, if you manually edit a BIG-IP FAST application outside of BIG-IP FAST using a method such as TMSH, the changes will be overwritten the next time BIG-IP FAST modifies the tenant.
Once a BIG-IP FAST template is used to deploy an application and tenant on a BIG-IP, BIG-IP FAST should continue to be used for that application and tenant.
BIG-IP AS3 should not be used to directly modify the application.
Please note: BIG-IP AS3 has a wider range of control over the BIG-IP configuration than BIG-IP FAST.
For example, BIG-IP AS3 can modify the /Common/Shared partition, while BIG-IP FAST cannot.
When a user modifies /Common/Shared via AS3, they should use AS3's per-tenant API to avoid modifying tenants that FAST is managing.

Does BIG-IP FAST collect any usage data?
----------------------------------------

BIG-IP FAST gathers non-identifiable usage data for the purposes of improving the product as outlined in the end user license agreement for BIG-IP.
To opt out of data collection, disable the BIG-IP systems phone home feature as described in the "Disabling the Automatic Phone Home" section of `K15000: Overview of the Automatic Update check and Automatic Phone Home features <https://support.f5.com/csp/article/K15000/>`_.

Is BIG-IP FAST officially supported by F5?
-----------------------------------------

Yes, beginning with v1.0 BIG-IP FAST is supported with the following requirements:

* BIG-IP TMOS v13.1 or later
* AS3 v3.16 or later must be installed see `Downloading and Installing AS3 <https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/userguide/installation.html>`_

What does this mean for iApp templates?
---------------------------------------

| iApp templates will not be removed or disabled and users are free to continue using iApp templates, subject to the EoL timeline.
| For additional information, see `K13422: F5-supported and F5-contributed iApp templates <https://support.f5.com/csp/article/K13422/>`_.

How are secrets handled in BIG-IP FAST templates?
-------------------------------------------------

When authoring a template, be cautious when entering sensitive data into your template such as passwords, certificates and monitor information to name a few.
BIG-IP FAST templates are stored and sent in plain text, and offer no additional security for secrets on top of what AS3 provides.
Therefore, careful consideration should be made when adding this type of data onto the template.
See :ref:`as3_secrets` for more information on handling secrets.


How do I remove all installed templates at once?
------------------------------------------------

A ``DELETE`` to the ``/templatesets`` endpoint will remove all installed Template Sets (including the ones shipped with the RPM):

   .. code-block:: shell

      curl -sku <BIG-IP username>:<BIG-IP password> -X DELETE https://<BIG-IP IP address>/mgmt/shared/fast/templatesets

Where can I find a list of known issues with BIG-IP FAST?
---------------------------------------------------------

| All known issues are now on GitHub as Issues for better tracking and visibility.
| See issues with a label of **Known Issue** at `BIG-IP FAST GitHub <https://github.com/F5Networks/f5-appsvcs-templates/issues>`_.
