.. _json:

Templating with JSON
==================

This chapter is dedicated to explaining the relationship of schema vs templates and covers JSON schema types, keywords and combining schema.  Schema is generated from template text, combined with definitions, and used to validate template parameters.  


JSON Schema Basic Types
----------------------------------

| **Array**: Arrays are used for ordered elements. Each element in an array is unique relative to one another. To ensure items in an array are unique, the *uniqueItems* identifier can be set to *true*.

.. code-block:: json

    {
        "type": "array",
        "uniqueItems": true
    }

| **Numeric Types**: JSON has two numeric types; *integer* and *number*.  
| An *integer* is used for integral (whole) numbers, while a *number* is any numerical value including integers and floating-point (decimal) numbers.  
|
| **Numeric Constraints**:
*Multiples*. *multipleOf* restricts a multiple to a set number. :ref:`combschema` has a detailed example of *multipleOf*

.. code-block:: json

    {
        "type"       : "number",
        "multipleOf" : 10
    }

*Ranges*. Combining *minimum* and *maximum* keywords for ranges or *exclusiveMinimum* and *exclusiveMaximum* for expressing exclusive ranges. The example below sets the *minimum* to 0 and the *exclusiveMaximum* to 100.  

.. code-block:: json

    {
        "type": "number",
        "minimum": 0,
        "exclusiveMaximum": 100
    }

.. NOTE::  With the *minimum* range of 0, then 0 is valid.  With an *exclusiveMaximum* of 100, 99 is valid while 100 is not.

**String**: The *string* type is used for strings of text and may contain Unicode characters.  The length of a *string* may be constrained using *minLength* and *maxLength* which cannot be a negative number.

.. code-block:: json

    {
        "type": "string",
        "minLength": 2,
        "maxLength": 3
    }

Along with the *string* type, JSON has some built in formats, using the *format* keyword.  This allows for basic validation and can be used for certain strings such as ipV4 and ipV6 addressing.  

.. seealso:: JSON schema `Built-in Formats <https://json-schema.org/understanding-json-schema/reference/string.html?highlight=maxlength#built-in-formats>`_ for more information.

| **Object**: Objects are the mapping type in JSON. Objects map *keys* to *values* and the *keys* are always strings enclosed by quotation marks. 
| A *value* can be a string, boolean, array or object. The pair is referred to as a key-value pair using the *properties* keyword.
|
| **Boolean**: The *boolean* type ``{ "type": "boolean" }`` matches two values; *true* or *false* and must be used in all lower case characters. 


.. _combschema:

Combining Schema
-------------------------

| JSON has keywords for combining schema together.
|
| **allOf**: All of the contained schemas must validate against the instance value.

.. code-block:: json

    {
        "allOf": [
            { "type": "string" },
            { "maxLength": 5 }
        ]
    }

.. NOTE::  When using *allOf*, be cautious of specifying multiple *types* such as ``{ type:  string }`` and ``{ type:  number }`` as a type cannot be a string and a number at the same time.

| **anyOf**: One or more of the contained schema is validated against the instance value.  It is less restrictive than *allOf* as more than one of the same *type* may be specified.

.. code-block:: json

    {
        "anyOf": [
            { "type": "string" },
            { "type": "number" }
        ]
    }

| **oneOf**: Validates against exactly one subschema even though multiple instances listed.  
| For example, if *multipleOf* is set to 5 and 3, validation will pass on 10 and 9, but will fail on 2 as neither 5 nor 3 are multiples of 2.  It will also fail on 15 as it is a *multipleOf*  both 5 and 3 not *oneOf*.

.. code-block:: json

    {
        "oneOf": [
            { "type": "number", "multipleOf": 5 },
            { "type": "number", "multipleOf": 3 }
        ]
    }

.. seealso:: For detailed information, additional code examples and references, visit `Understanding JSON Schema <https://json-schema.org/understanding-json-schema/index.html>`_
