'use strict';

const schema = `
$schema: http://json-schema.org/draft-07/schema#
$id: templateSchema
title: tempateSchema schema definition
oneOf:
  - allOf:
      - $ref: http://json-schema.org/draft-07/schema#
      - type: object
        properties:
          view:
            type: object
            description: a sample view to render the template with
          template:
            type: string
            format: mustache
            description: a mustache template component
          definitions:
            type: object
            additionalProperties:
              $ref: '#'
          allOf:
            type: array
            items:
              $ref: '#'
          oneOf:
            type: array
            items:
              $ref: '#'
          anyOf:
            type: array
            items:
              $ref: '#'
        required:
          - template
  - type: string
    format: mustache
description: |
  # templateSchema

  Provide a hiearchy of template snippets using mustache style templates.
  the system will digest and compile the mustache snippets and generate JSON
  schema that represents the input schema to the templates

  HTML Templating Example:
  \`\`\`yaml
    view:
      message: Hello!
    definitions:
      body:
        template:
          <body>
            <h1>{{message}}</h1>
          </body>
    template: |
      <html>
        {{> body}}
      </html>
  \`\`\`

  A templateSchema object is any object that passes this schema. In short,
  these objects are valid json schema with a required 'template' property that
  contains a mustache template.

  The framework mainly acts using the follow three propeties:

  template: the base template for this templateSchema object
  definitions: a dictionary of other templateSchema objects that can be used
    as partials in the top level template
  view: a view for the template will be rendered with

  When the system digests the schema, it will parse the template and any
  partials specified in the definitions object, and generate a top level schema
  of properties required to render the template.

  The view object is optional, and can be used to provide an example or defaults
  for the template.

  The top level schema generated from parsing the mustache template will be used
  to validate the view object. This schema can then be used to validate other
  views used to render the template.
`;

module.exports = {
    schema
};
