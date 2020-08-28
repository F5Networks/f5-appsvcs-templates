.. _advanced:

Appendix B: Advanced Features
=============================


Base64 Encoding
---------------

| Using the GUI, FAST has the ability to encode template parameters as base64, which becomes part of the template output (AS3 declaration).  
| iRules are a common use case, however AS3 supports base64 for a wide range of objects.
|
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


HTTP Calls to External Resources
--------------------------------

| Some template parameters may be sourced from other places, such as external APIs or databases.
| 
| A *Template.fetchHttp()* method does an HTTP request for each parameter definition that has a *url* property returning a parameter object with the response results. The value used from a response can be altered by specifying a *JSONPath* query in an optional data property of the parameter definition. *url* can also be an object matching Node's *http.request()* options object.
|
::

    type: object
     properties:
      url:
          description: HTTP resource to call to fetch data.
            oneOf:
            - type: string
            - type: object
    {{description: Something like Node request options}}
        data:
        type: string
        description: JSONPath of data to be fetched, must match schema
