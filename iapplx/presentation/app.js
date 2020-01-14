'use strict';

const yaml = require('js-yaml');

const { Template } = require('mystique');

const endPointUrl = '/mgmt/shared/f5-mystique';

const getJSON = endPoint => fetch(`${endPointUrl}/${endPoint}`).then((data) => {
    if (!data.ok) {
        throw new Error(`Failed to get data from ${endPointUrl}/${endPoint}: ${data.status} ${data.statusText}`);
    }
    return data.json();
});

const outputElem = document.getElementById('output');

const dispOutput = (output) => {
    console.log(output);
    outputElem.innerText = output;
};

let editor = null;

const injectFormatsIntoSchema = (schema) => {
    Object.values(schema).forEach((item) => {
        if (item !== null && typeof item === 'object') {
            if (item.type === 'boolean') {
                item.format = 'checkbox';
            } else if (item.type === 'array') {
                item.format = 'table';
            } else if (item.type === 'text') {
                item.type = 'string';
                item.format = 'text';
            }

            injectFormatsIntoSchema(item);
        }
    });
};

const newEditor = (tmplid) => {
    const formElement = document.getElementById('form-div');
    if (editor) {
        editor.destroy();
    }
    dispOutput(`Loading template: ${tmplid}`);
    getJSON(`templates/${tmplid}`)
        .then((data) => {
            return Template.fromJson(data);
        })
        .then((tmpl) => {
            const schema = tmpl.getViewSchema();
            dispOutput(`Creating editor with schema:\n${JSON.stringify(schema, null, 2)}`);

            // Prep the schema for JSON editor
            schema.title = schema.title || 'Template';
            injectFormatsIntoSchema(schema);
            dispOutput(`Injected formats into schema:\n${JSON.stringify(schema, null, 2)}`);

            // Create a new editor
            editor = new JSONEditor(formElement, {
                schema: tmpl.getViewSchema(),
                compact: true,
                disable_edit_json: true,
                disable_properties: true,
                disable_collapse: true,
                array_controls_top: true,
                theme: 'spectre',
                iconlib: 'fontawesome5'
            });
            dispOutput('Editor loaded'); // Clear text on new editor load

            // Load with defaults
            editor.on('ready', () => {
                editor.setValue(tmpl.defaultView);
                dispOutput('Editor ready');
            });

            // Hook up buttons
            document.getElementById('view-tmpl-btn').onclick = () => {
                dispOutput(tmpl.text);
            }
            document.getElementById('view-schema-btn').onclick = () => {
                dispOutput(JSON.stringify(tmpl.getViewSchema(), null, 2));
            }
            document.getElementById('view-render-btn').onclick = () => {
                dispOutput(JSON.stringify(yaml.safeLoad(tmpl.render(editor.getValue())), null, 2));
            };
            document.getElementById('form-btn').onclick = () => {
                const data = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: tmplid,
                        parameters: editor.getValue()
                    })
                };
                dispOutput(JSON.stringify(data, null, 2));
                fetch(`${endPointUrl}/applications`, data)
                    .then(response => response.json())
                    .then((result) => {
                        dispOutput(JSON.stringify(result, null, 2));
                    });
            };
        })
        .catch(e => dispOutput(`Error loading editor:\n${e.message}`));
};

const addTmplBtns = (tmplList) => {
    const elem = document.getElementById('tmpl-btns');
    tmplList.forEach((item) => {
        const btn = document.createElement('button');
        btn.innerText = item;
        btn.addEventListener('click', () => {
            newEditor(item);
        });
        elem.appendChild(btn);
    });
};

dispOutput('Fetching templates');
getJSON('templates')
    .then((data) => {
        addTmplBtns(data);
        dispOutput('');
    })
    .catch(e => dispOutput(e.message));
