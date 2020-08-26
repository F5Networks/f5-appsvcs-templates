.. _advanced:

Appendix B: Advanced Features
=============================


Base64 Encoding
---------------

Using the GUI, FAST has the ability to encode template parameters as base64, which becomes part of the template output (AS3 declaration).  

iRules are a common use case, however AS3 supports base64 for a wide range of objects.

In the following example, the iRules convert to a base64 string:

.. code-block:: json

    { 
        "irules":  [
            "/Common/_sys_APM_ExchangeSupport_helper",
            "/Common/_sys_APM_Office365_SAML_BasicAuth",
            "/Common/_sys_APM_activesync"
        ],
        "data": "I2;uY2x1ZGUgPGlvc3RyZwFtPgoKaW50IGlhaW4oKSB7CiAgICBzdGQ6OmNvdXQgPDwgIkhlbGxvIFdvcmxkISI7CiAgICByZXR1cm4gMDsKfQo="
    }


.. seealso:: `AS3 Schema Reference <https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html>`_ for a full list of **f5base64** fields.


Multiple Choice Lists
---------------------

While authoring a template, it is possible to specify multiple choice list boxes for use in cases such as iRules.

.. image:: iRuleList.png
   :width: 800

Some requirements must be met, which are:

* type must be *array*
* uniqueItems must be *true*
* items must have an *enum*

An example for generating a multi-select list box for iRules would be:

.. code-block:: json

    contentType: application/json             
    definitions:                                                                                                           
        irules:                                            
            type: array                                                                     
            uniqueItems: true                                                                  
            items:          
                type: string                              
                enumFromBigip: ltm/rule                      
     template: |                                                          
       {                                                                        
        "irules": {{irules::array}}                                                                   
       }   
