# Mystique Template Package Format

This document is intended to describe Mystique's template set format.

## File Structure

```
./
./templates
./schema
./metadata.yml
```
---

### ./templates

Each file in this directory is a different template option presented to the user.

Two file types are allowed in this directory:
`.mst`
`.yml`/`.yaml`

Each template is names according to the file name, minus the extension. If a directory structure exists inside `./templates`,
the template names are prefixed with their path inside `./templates`

`.mst` are mustache templates and the raw text of the file should be treated as the template text. A small example:

```
{
  "{{jsonPropertyName}}" : "{{jsonPropertyValue}}
}
```

`.yml` are YAML files and give the user more specification options,
this is the full template specification. All mustache style templates can easily be converted to this format inside the templating system.

```yaml
name: An Example YAML template
description: An Example
parameters:
  jsonPropertyName:
    enum:
      - propertyOne
      - propertyTwo
      - propertyThree
  jsonPropertyValue:
    type: string
    default: Hello World
  jsonPropertyAvailable:
    ref: externalType
template: |
  {
    "{{jsonPropertyName}}" : "{{jsonPropertyValue}}"
  }
```
This allows the user to specify types on a per template basis.

Please refer to `template_schema.yml` for the full specification of this format.

---

### ./schema

Each file in this directory is a piece of supplemental schema used by the templates in the set.

Two file types are allowed in this directory:
`.json`
`.yml`/`.yaml`

The contents of this file is json schema that can be used by every template in the set.

```yaml
$schema: http://...
definitions:
  typeOne: ...
  typeTwo: ...
  typeThree: ...
```
---

### metadata.yml

Global data about the template set for advanced users

What might go in this file:
- a list of published top level templates
- a list of valid partials
- schema overrides by variable name

Proposed Example:
```yaml
rootTemplates:
  - AppleTemplate
  - BananaTemplate
  - CherryTemplate
partials:
  - SeedTemplate
  - StemTemplate
definitionOverrides:
  propertyOne:
    default: hello
  propertyTwo:
    default: world
```

### defaults.yml

Yaml file specifying template wide overrides based on the variable names

```YAML
propertyOne: foo
propertyTwo: bar
propertyThree: baz
```

---

## Template text

Template text is typically a mustache/handlebars style template with a type annotation syntax:

Bare mustache:
```
{
  "{{propertyOne}}" : "{{propertyTwo}}"
}
```
* all properties assumed to be a string when not annotated

With Type Annotations:
```
{
  "{{propertyOne::string}}" : "{{propertyTwo:schemaFile:typeTwo}}"
}
```

Here we see `propertyOne` is a simple string, `propertyTwo` references the definition of `typeTwo` in a schema called `schemaFile` (schema would be `./schemas/schemaFile.json`)

Mustache templates can also contain comments:
```
{{!
  This is a comment!
}}
{
  "{{propertyOne::string}}" : "{{propertyTwo:schemaFile:typeTwo}}"
}
```

If the template is an .mst file, the top comment is assumed to be the description of the template.

* UI Note: Properties/Comments should be rendered together in order of appearance.

### Partials

Mustache allows something called a 'partial' which is a template
embedded within another template.

A mustache template that refers to a partial looks like this:
```
{
  "childData" : {{> childDataTemplate }}
}
```

Partials can refer to templates inside the templates directory. Certain template can be restricted within the set to be used as partials by specifying a root set and partials in the metadata file.


# Template Merging (proposed)

Javascript objects can be merged and if the resultant template object can be merged, we can support this.


TemplateA:
```
{
  "one" : {
    "foo" : 1
  },
  "two" : {
    "bar" : 2
  },
  "conflict" : {
    "myProperty" : "first_value"
  }
}
```

TemplateB:
```
{
  "one" : {
    "boo" : "one"
  },
  "three" : {
    "baz" : 3
  },
  "conflict" : {
    "myProperty" : "second_value"
  }
}
```

merge(TemplateA, TemplateB)
```
{
  "one" : {
    "foo" : 1,
    "boo" : "one"
  },
  "two" : {
    "bar" : 2
  },
  "three" : {
    "baz": 3
  },
  "conflict" : {
    "myProperty" : "first_value"
  }
}
```

For conflicts, we choose the property that was passed in first in the list of parameters.

- AS3 Declarations can be merged to add applications
- AS3 Declarations can be merged to add features

If a top level template is a merger of other templates, it can be specified in the metadata file.

```yaml
compositeTemplates:
  FruitSaladTemplate:
    - AppleTemplate
    - BananaTemplate
    - CherryTemplate
rootTemplates:
  - AppleTemplate
  - BananaTemplate
  - CherryTemplate
  - FruitSaladTemplate
partials:
  - SeedTemplate
  - StemTemplate
definitionOverrides:
  propertyOne:
    default: hello
  propertyTwo:
    default: world
```

... as applied to AS3:

```yaml
compositeTemplates:
  HTTPS_WAF_CompositeTemplate:
    - HTTPS_Template
    - WAF_Template
rootTemplates:
  - HTTPS_Template
  - HTTPS_WAF_CompositeTemplate
definitionOverrides:
  WAF_Policy:
    default: /Common/myPolicy.xml
```

# Calling functions

I may want to have the user input a number of values, make a calculation on those values, and insert the resulting evaluation into the template... how might this work?

```yaml
name: An Example YAML template
description: An Example
parameters:
  jsonPropertyName:
    enum:
      - propertyOne
      - propertyTwo
      - propertyThree
  jsonPropertyValue:
    type: function
    properties:
      address:
        format: ipv4
      port:
        type: integer
    call: packageIpAndPort
  jsonPropertyAvailable:
    ref: externalType
template: |
  {
    "{{jsonPropertyName}}" : {{jsonPropertyValue}}
  }
```

`packgeIpAndPort` must be specified somewhere, and it takes
a dictionary with an 'address' and 'port'. This function could
look like this (although a partial would work here):

```javascript
function(params) {
  return `${params.address}:${params.port}`;
}
```

# Generating Schema from Template Variables

When parsing a template, we get a list of sections. Each section is either text to be used literally, a comment, or a variable name.

```
...
{{variable}}
...
```

Lone variable names are turned to strings using their name as the title:

```
properties:
  variable:
    title: variable
    type: string
```

Annotated variables are filled in from their schema spec in the appropriate file, then global overrides are applied, and finally template specific overrides are applied.

# Generating UI from Schema

```yaml
properties:
  item_one:
    title: My First Item
    type: string
    description: The First Item to Create
    default: Some Default Value
  item_two:
    title: My Second Item
    type: integer
    description: My Second Item is actually a Port
    default: 443
  drop_down_menu:
    title: fancy drop down
    type: string
    enum:
      - choices
      - choices...
      - more choices
```

'title' is displayed as the title
'type' is JSON schema and can give us a hint at what form element to use
'description' can be displayed along with the parameter int he form

# Template Execution

the 'rootTemplates' are like the 'main' for each template...
as we parse the template and examine what needs to be done, we
iterate over the variables and replace values with user provided values, call functions, and render partials.

No order of execution is guaranteed. If order of execution is important, that should be handled in driver modules.

# For Consideration

## Overrides File

The overrides file would be a top level file that would give the user an 'inverted' view of the schema. In this file, the top level keys are used in place of the schema properties for that variable. So if 'myVariable' has an entry in 'default' with 'hello world', myVariable's new default would be 'hello world'.

This allows template authors to create meaningful naming conventions with their template variables, and have a global inverted view (e.g. list of defaults for all variables)

Overrides:
```
default:
  vip_address: 0.0.0.0
  vip_port: 443
  server_addresses:
    - 10.1.1.0
  server_port: 8080
description:
  server_addresses: A list of addresses of worker servers
title:
  vip_address: Service Address
  vip_port: Service Port
  server_addresses: Web Server Addresses
  server_port: Web Server Port
```

Original Schema generated from Template:

```
properties:
  vip_address:
    title: Service Address
    type: string
  vip_port:
    title: Service Port
    type: integer
  server_addresses:
    title: Server Addresses
    type: array
  server_port:
    title: Web Server Port
    type: integer
```

Resulting schema after Applying Overrides:

```
properties:
  vip_address:
    type: string
    default: 0.0.0.0
  vip_port:
    type: integer
    default: 443
  server_addresses:
    type: array
    default:
      - 10.1.1.0
    description: A list of addresses of worker servers
  server_port:
    type: integer
    default: 8080
```

## Import from Postman

Postman uses a 'lite' version of templating, using the same syntax as handlebars/mustache. It would be useful to be able to import a postman collection and have it automatically converted into a template set.

Each body is it's own template, and yaml metadata could be specified in the description of each request item.

Intended workflow/demo would be to begin your AS3 templating work with postman, ensuring the collection does everything you need it to do. Exporting and then importing into mystique should create a template set automatically from the postman collection.
