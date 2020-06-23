.. _faq:

FAST Frequently Asked Questions (FAQ)
=====================================

What is FAST (F5 Application Services Templates)?
-------------------------------------------------

The F5 Application Services Templates extension, or FAST, provides a way to streamline deployment of AS3 applications onto BIG-IP using AS3 deployment patterns, or templates.
FAST is the next phase of evolution for F5, unlocking new capabilities, aligning to multi-cloud, injecting automation, and empowering customers with our best-in-class application services.


See :ref:`about` for a more in-depth description of FAST.

*FAST is:*

* A new, flexible, and powerful front-end templating system
* An effective way to deploy applications on the BIG-IP system using AS3
* A cross-platform successor to iApp templates, built on top of our declarative APIs
* Seamless integration and insertion into CI/CD pipelines
* Compatibility with modern development languages like Node.js and Python

Do FAST templates utilize AS3?
------------------------------

FAST uses AS3 declarations to deploy applications and tenants. The declarative API represents the configuration which AS3 is responsible for creating on a BIG-IP system.
Therefore, if you manually edit a FAST template outside of FAST using a method such as TMSH for example, the changes will be overwritten the next time FAST modifies the tenant.
Once a FAST template is used to deploy an application and tenant on a BIG-IP, it should be used for that application and tenant.

Does FAST collect any usage data?
---------------------------------

The F5 Application Services Template (FAST) gathers non-identifiable usage data for the purposes of improving the product as outlined in the end user license agreement for BIG-IP.
To opt out of data collection, disable the BIG-IP systems phone home feature as described in `K15000: Overview of the Automatic Update check and Automatic Phone Home features <https://support.f5.com/csp/article/K15000/>`_,
Disabling the Automatic Phone Home feature section.

What F5 platforms does FAST support?
------------------------------------

FAST is initially targeted to the BIG-IP.

Is FAST supported?
------------------

Yes, beginning with v1.0 FAST is supported with the following requirements:

* BIG-IP TMOS v13.1 or later
* AS3 v3.16 or later must be installed see `Downloading and Installing AS3 <https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/userguide/installation.html>`_

What does this mean for iApp templates?
---------------------------------------

iApp templates will not be removed or disabled and users are free to continue using iApp templates, subject to the EoL timeline.

For additional information, see `K13422: F5-supported and F5-contributed iApp templates <https://support.f5.com/csp/article/K13422/>`_.

Are self-authored templates encrypted?
--------------------------------------

When authoring a template, be cautious when entering sensitive data into your template such as passwords, certificates and monitor information to name a few.
FAST does not encrypt the data and it will remain as plain text.
Careful consideration should be made when adding this type of data onto the template.

I want to remove all saved templates at once, how do I do this?
---------------------------------------------------------------

A ``DELETE`` to the ``/templatesets`` endpoint will remove all installed Template Sets (including the ones shipped with the RPM):

   .. code-block:: shell

      curl -sku admin:Pass1w0rd -X DELETE https://192.0.2.87/mgmt/shared/fast/templatesets

Saved templates can be removed individually using the BIG-IP GUI.
