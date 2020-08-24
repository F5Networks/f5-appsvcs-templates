.. _advanced:

Appendix B: Advanced Features
=============================


Base64 Encoding
---------------

FAST has the ability encode template parameters as base64, which becomes part of the template output (AS3 declaration).  iRules are a common use case, however AS3 supports base64 for a wide range of objects.

In the following example, the iRules convert to a base64 string:
::
    { 
        "irules":  [
            "/Common/_sys_APM_ExchangeSupport_helper",
            "/Common/_sys_APM_Office365_SAML_BasicAuth",
            "/Common/_sys_APM_activesync"
        ],
        "data": "I2;uY2x1ZGUgPGlvc3RyZwFtPgoKaW50IGlhaW4oKSB7CiAgICBzdGQ6OmNvdXQgPDwgIkhlbGxvIFdvcmxkISI7CiAgICByZXR1cm4gMDsKfQo="
    }

See the `AS3 Schema Reference <https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html>`_ for a full list of **f5base64** fields.

HTTP Forwarding
---------------

Forwarding the template results as the body of an HTTP request by adding a keyword to the **httpForward** top level template schema.

These supported parameters from the Node.js request options:

* auth string
* defaultPort number
* family number 
* headers Object
* host string 
* hostname string
* insecureHTTPParser boolean
* localAddress string
* lookup Function
* maxHeaderSize number
* method string
* path string
* port number
* protocol string
* setHost boolean:
* timeout number:

For example, if a URL is specified with no options, default to HTTP POST:
::

    httpForward:
     url: http://example.com/path?query=parameter
        options:
         ... enumerated options ... 


