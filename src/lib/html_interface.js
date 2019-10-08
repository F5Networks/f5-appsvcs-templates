const HtmlTemplate = require('./html_engine.js').HtmlTemplate;

const emoji = require('./emoji.json');

const typeEmojis = emoji.filter(x => x.no <= 567 && x.no >= 540);

const ownEmojis = emoji.filter(x => x.no <= 307 && x.no >= 250 ||
  x.no <= 334 && x.no >= 314);

const appTypeHash = t => Array.from(t)
    .map(x => x.charCodeAt(0))
    .reduce((acc, cur) => acc * cur + cur, 17) % typeEmojis.length;

const ownTypeHash = t => Array.from(t)
    .map(x => x.charCodeAt(0))
    .reduce((acc, cur) => acc * cur + cur, 17) % ownEmojis.length;


const createView = function (data) {
    console.log(data);
    return {
        table_rows: data.rows[0] && data.rows[0].template_name
            ? data.rows.reverse()
                .map(i => Object.assign(i,
                    {
                        emoji: `&#x${typeEmojis[appTypeHash(i.template_name)].codes.split(' ')[0]};`,
                        owner: `&#x${ownEmojis[ownTypeHash(i.tenant_name)].codes.split(' ')[0]};`,
                        pools: (() => {
                            const d = JSON.parse(i.config);
                            const f = Object.keys(d)
                                .filter(k => d[k].class === 'Pool')
                                .map(k => d[k]);
                            console.log(d);
                            console.log(f);
                            return f;
                        })(),
                        services: (() => {
                            const d = JSON.parse(i.config);
                            const f = Object.keys(d)
                                .filter(k => d[k].virtualAddresses)
                                .map(k => d[k]);
                            return f;
                        })(),
                    }))
            : data.rows.reverse(),
        message() {
            return this.input.slice(0, 100);
        },
        config_raw() {
            return `<pre>${
                JSON.stringify(JSON.parse(this.config), null, 2)
                    .split('\n')
                    .map(x => (x.length > 80 ? x.slice(0, 80) : x))
                    .join('\n')
            }</pre>`;
        },
        tenant_summary() {
            const config = JSON.parse(this.config);
            const apps = Object.keys(config).filter(k => config[k].class === 'Application');
            const html = apps.map((k) => {
                const a = config[k];
                if (a.label) {
                    return `<div class="highlight group">
          <div style="flex-grow: 1;">${k}</div><div>${a.label}</div>
          </div>`;
                }
                return `<div class="group">${k}</div>`;
            }).join('');
            return html;
        },
    };
};

const applicationRow = `<div style="display:flex;flex-direction:column;">
<div><span style="font-size:1.8em" title="{{template_name}}">{{emoji}}</span>
<span style="font-size:1.8em" title="{{tenant_name}}">{{owner}}</span></div>
<div>{{#services}}{{#virtualAddresses}}{{.}}{{/virtualAddresses}}{{/services}}</div>
<div style="background-color:{{Selection}};overflow:hidden;">{{name}}</div>
<div style="display:flex;flex-direction:column">
{{#pools}}{{#members}}{{#serverAddresses}}<div>{{.}}</div>{{/serverAddresses}}{{/members}}{{/pools}}
</div>
</div>`;

const tenantsRow = '<td><h2>{{name}}</h2><p class="timestamp">created {{created}}</p></td><td>{{tenant_summary}}</td>'
      + '<td><form method="post" action="/api/deploy/delete_tenant"><input type="hidden" name="tenant_name" value="{{name}}">'
      + '<input class="submit" type="submit" value="delete"></form></td>';
const serviceEdgesRow = '<td>{{tenant_name}}</td><td>{{application_name}}</td>'
      + '<td>{{service_name}}</td><td>{{frontend_address}}</td>'
      + '<td>{{frontend_port}}</td><td>{{ipaddress}}</td>';

const deviceStatus = `<div style="flex-direction:row;">
{{#as3_installed}}
<div><a href="https://{{ipaddress}}:{{port}}/mgmt/shared/appsvcs/declare" target="_blank" rel="noopener noreferrer">
<img src="/AS3_Robot.png" width="34"/></a></div>
{{/as3_installed}}
{{#ts_installed}}<div><img src="/Telemetry_streaming_robot.png" width="34"/></div>{{/ts_installed}}
</div>`;

const devicesRow = `<td>{{id}}</td>
<td><a href="https://{{ipaddress}}:{{port}}/" target="_blank" rel="noopener noreferrer">{{ipaddress}}:{{port}}</a></td>
<td>{{username}}</td><td>{{> device_status}}</td>`;

const templateTasksRow = '<td>{{template}}</td><td>{{txid}}</td><td>{{status}}</td><td>{{message}}</td><td>{{modified}}</td>';

const partial = {
    applications: { row_values: applicationRow },
    tenants: { row_values: tenantsRow },
    service_edges: { row_values: serviceEdgesRow },
    devices: { row_values: devicesRow, device_status: deviceStatus },
    template_tasks: { row_values: templateTasksRow },
};

const htmlTemplate = new HtmlTemplate('partial_html');
const appTemplate = new HtmlTemplate('application_html');
let db;
const getTableHtml = table => db.getTableJson(table).then((result) => {
    const base = table === 'applications' ? appTemplate : htmlTemplate;
    const frame = base.render(result, partial[table], createView);
    return frame;
});

module.exports = {
    getTableHtml,
};
