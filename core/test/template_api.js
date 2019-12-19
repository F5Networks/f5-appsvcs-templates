/* eslint-disable */
process.AFL_HE_ROOT_DIR = '../html/'

const { TemplateEngine } = require('../lib/template_engine.js');

const { FsTemplateProvider } = require('../lib/template_provider.js');

const mustache_template = `{
    "name" : "test template",
    "default" : "{{variable1}}",
    "string_type" : {{string_variable::string}},
    "text_type" : {{text_variable::text}},
    "array_type" : {{array_variable::array}},
    "boolean_type" : {{boolean_variable::boolean}},
    "number_type" : {{number_variable::number}},
    "{{key_name}}" : "{{variable1}}"
  }`;

const form_params = () => {
  return {
    key_name: "value",
    variable1: "value1",
    string_variable: "silly string",
    text_variable: "text\nwith\nlinebreaks",
    array_variable: [ "a", "b", "c" ],
    boolean_variable: true,
    number_variable: 131,
  };
}

describe('template engine tests', function() {
  it('schema generation', function() {
    const te = new TemplateEngine('sample', mustache_template);
    const reference = { type: 'object',
      properties:
       { variable1: { default: 'myComponent' },
         string_variable: { form_type: 'string', type: 'string', default: 'myComponent' },
         text_variable: { form_type: 'text', type: 'string', default: 'myComponent' },
         array_variable: { form_type: 'array', type: 'array', default: [Array] },
         boolean_variable: { form_type: 'boolean', type: 'boolean', default: true },
         number_variable: { form_type: 'number', type: 'number', default: 131 },
         key_name: { default: 'myComponent' } },
      required:
       [ 'variable1',
         'string_variable',
         'text_variable',
         'array_variable',
         'boolean_variable',
         'number_variable',
         'key_name' ] };

    if( te.as3_view_schema.required.length !== reference.required.length )
      throw new Error('rendered schema does not match reference');
  });
  it('schema validation', function() {
    const te = new TemplateEngine('sample', mustache_template);
    const form = form_params();
    const err = te.validate(form);
    if(err) throw new Error(err);
  });
  it('render template'  , function() {
    const te = new TemplateEngine('sample', mustache_template);
    const frame = te.render(form_params());
    if(frame.string_type !== form_params().string_variable)
      throw new Error('bad render')
  });
  it('render template form'  , function() {
    const te = new TemplateEngine('sample', mustache_template);
    // check default form rendering
    const f1 = te.form_html();
    if( f1.indexOf('<input type="hidden" name="application_name" value="app_1"/>') >= 0)
      throw new Error('rogue application name injected into form');

    // check that provided defaults are inserted into html
    const f2 = te.loadWithDefaults({
      application_name: "app_1",
      key_name: "mutated_value",
      variable1: "value1_changed",
      string_variable: "silly string",
      text_variable: "text\nwith\afew\nmore\nlinebreaks",
      array_variable: [ "a", "b", "c" ],
      boolean_variable: true,
      number_variable: 131,
    });
    //check that application_name is included in form
    if( f2.indexOf('<input type="hidden" name="application_name" value="app_1"/>') < 0 )
      throw new Error('application name not injected into form');
    // ensure original defaults are loaded


    const f3 = te.form_html();
    if ( f3.indexOf('myComponent') <= 0 )
      throw new Error('form not rendered as expected');

    let unreachable = false;
    try {
      const f4 = te.loadWithDefaults()
      unreachable = true;
    } catch(e) {

    }
    if(unreachable)
      throw new Error('expected error to be thrown');
  });
})
