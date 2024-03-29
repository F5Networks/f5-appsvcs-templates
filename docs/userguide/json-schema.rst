.. _json:

Templating with F5 BIG-IP FAST
==============================

This chapter is dedicated to explaining the relationship of schema vs templates. 
BIG-IP FAST makes use of Mustache, JSON schema and JSONPath, therefore BIG-IP FAST may be familiar if you already understand any of these syntaxes.  
BIG-IP FAST combines these technologies to provide a complete templating solution. At the foundation, BIG-IP FAST uses a templating specification called mustache to convert parameters into a fully rendered API body. 
Parameter types can be specified in JSON schema, and are used to validate template inputs when the template is rendered. 
BIG-IP FAST will auto generate a schema for each template based off the template and json-schema provided.
Schema is generated from template text, combined with definitions, and used to validate template parameters.  

Mustache
--------
Mustache is not the templating engine. Mustache is a specification for a templating language, and it specifies how the template file must look. 
You write templates adhering to the Mustache specification, and it works by expanding tags in a template using values provided in a hash or object.  
The template is then rendered to create an output.
 
Tags
^^^^

Tags are easily identifiable by the `double mustache` of opening and closing curley braces ``{{ }}``. 
The most basic type of tag is a variable. When Mustache process the template it passes an object or hash containing the variable name and associated values.
A ``{{tenant}}`` tag in a template renders the value of the `tenant` key.


Sections
^^^^^^^^
| For iterating over a list of data, we make use of Mustache sections. 
| Sections render blocks of text zero or more times, depending on the value of the key in the current context.
| A section begins with a pound and ends with a slash. That is, {{#person}} begins a *"person"* section while {{/person}} ends it.
| The behavior of the section is determined by the value of the key.

Using the *person* section example from above, 2 types of lists can be created: *Empty List* or *Non-Empty List*.

**False Values or Empty Lists**

If the *person* key exists, and has a value of false, or an empty list, the text between the pound and slash will not be displayed.
In the following example, *person* has a ``parameter: false``, therefore RED will not be displayed, resulting in the ``Rendered Output: BLUE``.

.. code-block:: yaml

    {{#person}}
        "RED"],
    {{/person}
    {{^person}}
        "BLUE",
    {{/person}}

Parameters:

.. code-block:: json

    person: false

Output:

.. code-block:: none

 BLUE

**Non-Empty Lists**

When the value is a non-empty list, the text in the block will be displayed once for each item in the list. 
The context of the block will be set to the current item for each iteration. In this way we can loop over collections.

Template:

.. code-block:: yaml

    {{#repo}}
         <b>{{name}}</b>
    {{/repo}}
      "repo": [
      { "name": "resque" },
      { "name": "hub" },
      { "name": "rip" }
     ]
    }

Outputs:

.. code-block:: none

 <b>resque</b>
 <b>hub</b>
 <b>rip</b>


.. seealso:: `Mustache Manual <https://mustache.github.io/mustache.5.html>`_ for more information on Sections.


Partials
^^^^^^^^
Along with sections, Mustache utilizes partials. Mustache partials can be thought of as a way to insert template snippets.
The syntax for including a partial uses curley braces and an angle bracket {{> }}. 

For BIG-IP FAST, a partial definition must contain template text, i.e., define a template property

.. code-block:: yaml

  definitions:
    partialDef:
      template: |
        {{#useVar}}
          {{var}}
        {{/useVar}}
    useVar:
      type: boolean
    template: |
    {{> partialDef}}
    {{> partialDef}}


Parameters:

.. code-block:: json

    {
    "useVar": true,
    "var": "sample"
    }


Outputs:

.. code-block:: none
    
 sample
 sample


.. seealso:: `Mustache Manual <https://mustache.github.io/mustache.5.html>`_ for more information on Partials.

Overlaid Definitions
^^^^^^^^^^^^^^^^^^^^

The way BIG-IP FAST generates parameter definitions can be surprising at times if that parameter shows up multiple times in the template text. 

When generating parameter definitions, BIG-IP FAST looks at the following locations **in the following order**, with later definitions overriding/modifying previous ones:

1. Embedded mustache tags in any merged templates.  For example: ``{{var:f5:port}}``
2. The *definitions* properties of any merged templates. Templates are merged by name using ``$ref`` inside a *oneOf*, *anyOf*, or *allOf* clause.
3. Embedded mustache tags in the primary template. 
4. The *definitions* property in the primary template.
5. The *parameters* property in any merged templates.
6. The *parameters* property in the primary template.

**Notes**

* If a duplicate Mustache tag exists in the template, then the last encountered tag is used for the definition. The order that Mustache tags are parsed in should not be assumed.
* Properties within the definition (e.g., title, description, type, format, default, etc.) are merged together as they are found with newer data taking precedence over old data on key conflicts.
* Values from the parameters property of YAML templates will be used in place of the default from the parameter definition but will not actually update the definition itself.


JSON Schema Basic Types
-----------------------

Definitions
^^^^^^^^^^^
| JSON Schema allows us to define auxiliary schema in order to be reused and combined later on. 
| This involves two steps: 
| 1. We need to define the subschemas to be used later on, and 
| 2. We need a standard for calling and reusing these definitions.
|
To establish a difference between the main schema and the auxiliary definitions, we adopt the convention that every JSON Schema document consists of two parts; a JSON Schema, and a set of definitions.  

For example, if we want a definition for virtuals, it may look like this:

.. code-block:: yaml

    definitions:
        virtuals:
            type: array
            items:  {
	            type: string,
	            format: ipv4
        }

.. seealso:: `JSON Editor: $ref and definitions <https://github.com/json-editor/json-editor#ref-and-definitions>`_ for additional code examples.

| **Array**: Arrays are used for ordered elements. 
In JSON, each element in an array may be of a different type.  
Elements of the array may be ordered or unordered based on the API being templated.
This section covers typical JSON schema definitions for common patterns.

For example, *virtuals* is defined with a *type: array* having *items* defined with *type: string* and *format: ipv4* (more on formats later).

.. code-block:: yaml

    definitions:
        virtuals:
            type: array
            items:
                type: string
                format: ipv4
    
| **Numeric Types**: JSON has two numeric types; *integer* and *number*.  
| An *integer* is used for integral (whole) numbers, while a *number* is any numerical value including integers and floating-point (decimal) numbers.  
|
**Ranges**: Combining *minimum* and *maximum* keywords for ranges or *exclusiveMinimum* and *exclusiveMaximum* for expressing exclusive ranges. 
The example below defines the range of port numbers as *type: integer*.

.. code-block:: yaml

    type: integer
    minimum: 0
    maximum: 65535

Another example is combining *minimum* and *exclusiveMaximum*. 
When using a *minimum* range of 0, then 0 is valid.  With an *exclusiveMaximum* of 65535, 65534 is valid while 65535 is not.

.. code-block:: yaml

    type: number
    minimum: 0
    exclusiveMaximum: 65535
    
**String**: The *string* type is used for strings of text and may contain Unicode characters. 
The length of a *string* may be constrained using *minLength* and *maxLength* which cannot be a negative number.

.. code-block:: yaml

    type: string
    minLength: 2
    maxLength: 5
    
Along with the *string* type, JSON has some built in formats, using the *format* keyword.  
This allows for basic validation and can be used for certain strings such as IPv4 and IPv6 addressing.  

| Regular Expressions (regexes) are used to match and extract parts of a string by searching for one or more matches of a search *pattern*.  
| This example matches numbers from 0 and 255. ``String zeroTo255 = "([01]?[0-9]{1,2}|2[0-4][0-9]|25[0-5])"``
|
| The string consists of three groups separated with a pipe.
| 1. [01]?[0-9]{1,2} - Matches any number between 0 and 199. [01]?: 0 or 1 may appear at most once at front of the number. [0-9]{1,2}: digits 0 to 9 may appear exactly once or twice on the 2nd or 3rd position in the number.
| 2. 2[0-4][0-9] - Matches numbers between 200 and 249, where the first digit is always 2, the second is between 0 and 4, and the third digit is any between 0 and 9,
| 3. 25[0-5]: (the 3rd group) matches numbers between 250 and 255, where 25 is always at front and the third digit is between 0 and 5.



.. seealso:: JSON schema `Built-in Formats <https://json-schema.org/understanding-json-schema/reference/string.html?highlight=maxlength#built-in-formats>`_ and `Regular Expressions <https://json-schema.org/understanding-json-schema/reference/string.html#id6>`_ for more information.

| **Boolean**: The *boolean* type ``{ type: boolean }`` matches two values; *true* or *false* and must be used in all lower case characters. 


.. _combschema:

Combining Schema
----------------

| JSON uses the keywords *allOf*, *anyOf* and *oneOf* for combining schema together.  
| BIG-IP FAST also uses they keywords of *oneOf/allOf/anyOf* for template merging, however this section is focused on JSON schema.
|
| **anyOf**: One or more of the contained schema is validated against the instance value.  
It is less restrictive than *allOf* as more than one of the same *type* may be specified.

.. code-block:: json

    {
        "anyOf": [
            { "type": "string" },
            { "type": "number" }
        ]
    }

| **oneOf**: Validates against exactly one subschema even though multiple instances listed.  
| For example, if *multipleOf* is set to 5 and 3, validation will pass on 10 and 9, but will fail on 2 as neither 5 nor 3 are multiples of 2.  
It will also fail on 15 as it is a *multipleOf*  both 5 and 3 not *oneOf*.

.. code-block:: json

    {
        "oneOf": [
            { "type": "number", "multipleOf": 5 },
            { "type": "number", "multipleOf": 3 }
        ]
    }

| **allOf**: All of the contained schemas must validate against the instance value.

.. code-block:: json

    {
        "allOf": [
            { "type": "string" },
            { "maxLength": 5 }
        ]
    }

.. NOTE::  When using *allOf*, be cautious of specifying multiple *types* such as ``{ type: string }`` and ``{ type: number }`` as a type cannot be a string and a number at the same time.

When authoring templates using yaml, *allOf* takes on a special meaning by referencing another template in the set, known as *Template Merging*.

* *allOf* will merge the schema of the merge template with external template(s) just as JSON schema will when generating schema for the merged templates
* When a merge template is rendered, the JSON output of the templates will be merged together
* Merge can be used to add additional configuration to a template

.. code-block:: yaml

    parameters:
        ...
    definitions:
        ...
    template: | 
        ...
    allOf:
        - $ref: "tcp.yaml#"


.. seealso:: For detailed information, additional code examples and references, visit `Understanding JSON Schema <https://json-schema.org/understanding-json-schema/index.html>`_
