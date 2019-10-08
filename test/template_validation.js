/* eslint-disable */
process.AFL_HE_ROOT_DIR = './src/html/'

const te = require('../src/lib/template_engine.js');

const { FsTemplateProvider, GitHubTemplateProvider } = require('../src/lib/template_provider.js');

const provider = new FsTemplateProvider('./src/templates', './src/schemas')
//const provider = new GitHubTemplateProvider('zinkem5/f5-as3-templates');

const run_template = async (template_name, context) => {
  const engine = await provider.fetch(template_name);
  outfile.write(engine.as3_params_table);
  outfile.write(engine.as3_template);
  outfile.write(engine.as3_view_schema);
  outfile.write(engine.form_html);
  const err = engine.validate(context);
  if (err) throw err;
  //outfile.write('view', context);
  const rendered = engine.render(context);
  outfile.write(rendered);
  return rendered;
}

const input_map = {
  simple_asm : {
    uuid: '3456',
    tenant_name: 'zinke',
    application_name: 'app2',
    virtual_address: '3.6.7.8',
    server_addresses: '2.3.4.5'
  },
  simple_http : {
    uuid: '3456',
    tenant_name: 'zinke',
    application_name: 'app2',
    virtual_address: '3.6.7.8',
    server_addresses: '2.3.4.5'
  },
  simple_http_policy : {
    uuid: '3456',
    tenant_name: 'zinke',
    application_name: 'app2',
    virtual_address: '3.6.7.8',
    server_addresses: '2.3.4.5'
  },
  simple_https : {
    server_address: [ '1.2.3.4' ],
    certificate: 'foo\nbar',
    uuid: '1234-5678-9101',
    tenant_name: 'tenant1',
    application_name: 'app1',
    virtual_address: '0.0.0.0',
    private_key: 'foo\nbar\nbaz\boo'
  },
  simple_https_asm: {
    server_address: [ '1.2.3.4' ],
    certificate: 'foo\nbar',
    uuid: '1234-5678-9101',
    tenant_name: 'tenant1',
    application_name: 'app1',
    virtual_address: '0.0.0.0',
    private_key: 'foo\nbar\nbaz\boo'
  },
  simple_irule : {
    uuid: '3456',
    tenant_name: 'zinke',
    application_name: 'app2',
    virtual_address: '3.6.7.8',
    server_addresses: '2.3.4.5',
    iRule_comment: 'foo!',
    iRule_code: 'fooey\nfooey\nfoo'
  },
  simple_tcp: {
    uuid: '3456',
    tenant_name: 'zinke',
    application_name: 'app2',
    virtual_address: '3.6.7.8',
    virtual_port: 40,
    server_addresses: '2.3.4.5'
  },
  simple_udp: {
    uuid: '3456',
    tenant_name: 'zinke',
    application_name: 'app2',
    virtual_address: '3.6.7.8',
    virtual_port: 40,
    server_addresses: '2.3.4.5'
  },
  f5_service: {
    service_type: 'Service_HTTP',
    tenant_name: 'zinke',
    virtual_address: '3.6.7.8',
    virtual_port: 40,
    server_addresses: [ '2.3.4.5' ],
    service_port: 55,
  },
  f5_https: {
    service_type: 'Service_HTTP',
    tenant_name: 'zinke',
    virtual_address: '3.6.7.8',
    virtual_port: 40,
    server_addresses: [ '2.3.4.5' ],
  },
  f5_l7_header_replace: {
    "tenant_name": "tenant_named",
    "virtual_port": 80,
    "virtual_address": "10.0.2.5",
    "server_addresses": ["10.5.6.8","10.5.6.4"],
    "matching": "first-match",
    "when_condition": "request",
    "header_name": "Content-Type",
    "operand": "equals",
    "match_condition_value": ["text/plain"],
    "when_action": "request",
    "new_value": "application/json"
  },
  f5_l7policy: {
    "tenant_name": "tenant_named",
    "virtual_address": "80.0.0.1",
    "virtual_port": 80,
    "server_port": 80,
    "server_address": ["10.5.6.8","10.5.6.4"],
    "uuid": "1234",
    "matching": "best-match",
    "condition": "httpUri",
    "match_on": "path",
    "match_string": ["/login","/logout"],
    "action": "httpUri",
    "when": "response"
  }
}

const fs = require('fs');
const files = fs.readdirSync('./src/templates');

const testlog = fs.createWriteStream('./test-output.txt');

const outfile = {

  write: (message) => {

    const param = (() => {
      if( Buffer.isBuffer(message))
        return `${new Date()} ${message.toString(utf8)}\n`;
      if( typeof message === 'string')
        return `${new Date()} ${message}\n`;
      return `${new Date()} ${JSON.stringify(message, null, 2)}\n`;
    })();
    testlog.write(param)
  }
}

describe('template valid-json', function() {

  it('audit template tests', function() {
    files.map(i => i.split('.')[0])
      .forEach((f) => {
        if(f && !input_map[f])
          throw new Error('No test for template ' + f)
      });
  });

  it('provider FsTemplateProvider list', async function() {
      outfile.write('FsTemplatePrivder.list');
      const result = await provider.list();
      outfile.write(result);
  });

  it('provider GitHubTemplateProvider list', async function() {
      outfile.write('GitHubTemplateProvider.list');
      const github_provider = new GitHubTemplateProvider('zinkem5/f5-as3-templates');
      const result = await github_provider.list();
      outfile.write(result);
  });

  for(let i in input_map) {
    it(i, async function() {
      outfile.write(this.title);
      outfile.write(i)
      const result = await run_template(i, input_map[i])
      outfile.write(input_map[i]);
      outfile.write(result);
      outfile.write(result.class);
    });
  }

  it('simple_https_2', async function() {
    const context = {
      server_address: [ '1.2.3.4', '1.2.3.5' ],
      certificate: 'foo\nbar',
      uuid: '1234-5678-9101',
      tenant_name: 'tenant1',
      application_name: 'app1',
      virtual_address: '0.0.0.0',
      private_key: 'foo\nbar\nbaz\boo'
    }

    const result = await run_template('simple_https', context)
    outfile.write(this.title);
    outfile.write(context);
    outfile.write(result);
    outfile.write(result.class);
  });

  it('simple_https_3', async function() {
    const context = {
      "server_address": "1.2.3.4", //["foo","bar","goo"],
      "certificate": "foo\nbar",
      "private_key": "foo\nbar",
      "bad_key": "blah"
    };

    const result = await run_template('simple_https', context)
    outfile.write(this.title);
    outfile.write(context);
    outfile.write(result);
    outfile.write(result.class);
  });

  it('simple_http_1', async function() {
    const context = {
      uuid: '3456',
      tenant_name: 'zinke',
      application_name: 'app2',
      virtual_address: '3.6.7.8',
      backend_port: 40,
      server_addresses: '2.3.4.5'
    }

    const result = await run_template('simple_http', context)
    outfile.write(this.title);
    outfile.write(context);
    outfile.write(result);
    outfile.write(result.class);
  });
  it('simple_http_2', async function() {
    const context = {
      uuid: '3456',
      tenant_name: 'zinke',
      application_name: 'app2',
      virtual_address: '3.6.7.8',
      backend_port: 40,
      server_addresses: '2.3.4.5',
      enable: true
    }

    const result = await run_template('simple_http', context)
    outfile.write(this.title);
    outfile.write(context);
    outfile.write(result);
    outfile.write(result.class);
  });

  it('cdt_service 1', async function() {
    const { FsSchemaProvider } = require('../src/lib/schema_provider.js');
    const context = {
      service_type: 'Service_HTTP',
      tenant_name: 'zinke',
      virtual_address: '3.6.7.8',
      virtual_port: 40,
      server_addresses: [ '2.3.4.5' ],
    }
    outfile.write('cdt_service');
    const result = await run_template('f5_service', context);
    outfile.write(context);
    outfile.write(result);
    outfile.write(result.class);

  });

  it('cdt_service defined app name', async function() {
    /**
    *   the 'f5_service' template being used has an application_name
    *   that is auto generated using a uuid the first time it is created
    *
    *   upon editing, the special variable "application_name" may be provided
    *   and the template engine will insert the application using that value
    *
    *   it may also be used in the template, but the user will be asked to
    *   specify an aplication name
    *
    *   this test ensures the 'edit' behavior that preserves the
    *   provided application_name in the rendered template
    */
    const { FsSchemaProvider } = require('../src/lib/schema_provider.js');
    const context = {
      application_name: 'arbitrary42',
      service_type: 'Service_HTTP',
      tenant_name: 'zinke',
      virtual_address: '3.6.7.8',
      virtual_port: 40,
      server_addresses: [ '2.3.4.5' ],
    }
    outfile.write('cdt_service overwrite specifying application_name');
    const result = await run_template('f5_service', context);
    outfile.write(context);
    outfile.write(result);
    outfile.write(result.class);
    if( !result.declaration.zinke.arbitrary42 ||
        Object.keys(result.declaration.zinke).length !== 2 )
        throw new Error('error in application_name');
  });

});
