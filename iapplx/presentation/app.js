'use strict';

const yaml = require('js-yaml');

const { Template, guiUtils } = require('mystique');

const endPointUrl = '/mgmt/shared/f5-mystique';

const getJSON = endPoint => fetch(`${endPointUrl}/${endPoint}`).then((data) => {
    if (!data.ok) {
        throw new Error(`Failed to get data from ${endPointUrl}/${endPoint}: ${data.status} ${data.statusText}`);
    }
    return data.json();
});

let editor = null;

let outputElem;

const dispOutput = (output) => {
    console.log(output);
    if (outputElem) {
        outputElem.innerText = output;
    }
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
            guiUtils.modSchemaForJSONEditor(schema);
            dispOutput(`Schema modified for the editor:\n${JSON.stringify(schema, null, 2)}`);

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
                dispOutput(tmpl.templateText);
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

// Setup basic routing

const routes = {};
function route(path, pageName, pageFunc) {
    routes[path] = { pageName, pageFunc };
}

function router() {
    const rawUrl = location.hash.slice(1) || '/';
    const url = rawUrl.replace(/\/application.*?\/edit/, '/');
    const routeInfo = routes[url];
    const elem = document.getElementById('app');

    // Remove old content
    while (elem.firstChild) {
        elem.firstChild.remove();
    }

    // Error on unknown route
    if (!routeInfo) {
        const msg = `Could not find route info for url: ${url} (raw was ${rawUrl})`;
        elem.innerText = msg;
        console.error(msg);
        return;
    }

    // Load new page
    const pageId = `#page-${routeInfo.pageName}`;
    const pageTmpl = document.querySelector(pageId);
    elem.appendChild(document.importNode(pageTmpl.content, true));

    if (routeInfo.pageFunc) {
        routeInfo.pageFunc();
    }
}

window.addEventListener('hashchange', router);
window.addEventListener('load', router);


// Define routes
route('/', 'home');
route('apps', 'apps', () => {
    outputElem =  document.getElementById('output');
    const listElem = document.getElementById('applist');
    dispOutput('Fetching applications list');
    getJSON('applications')
        .then((appsList) => {
            appsList.forEach((appName) => {
                const li = document.createElement('li');
                li.innerText = appName;
                listElem.appendChild(li);
            });
            dispOutput('');
        })
        .catch(e => dispOutput(e.message));
});
route('create', 'create', () => {
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
    outputElem =  document.getElementById('output');
    dispOutput('Fetching templates');
    getJSON('templates')
        .then((data) => {
            addTmplBtns(data);
            dispOutput('');
        })
        .catch(e => dispOutput(e.message));
});
