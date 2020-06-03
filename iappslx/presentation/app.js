/* eslint-env browser */
/* eslint-disable no-console */

'use strict';


const yaml = require('js-yaml');

const { Template, guiUtils } = require('@f5devcentral/f5-fast-core');

const UiBuilder = require('./js/ui-builder.js');
const NavigationBar = require('./components/navigation-bar.component');

const endPointUrl = '/mgmt/shared/fast';

const UI = new UiBuilder();

const safeFetch = (uri, opts) => {
    opts = Object.assign({
        // Add any defaults here
    }, opts);

    return fetch(uri, opts)
        .then(response => Promise.all([
            Promise.resolve(response),
            response.text()
        ]))
        .then(([response, textData]) => {
            let data = textData;
            let isJson = false;
            try {
                data = JSON.parse(textData);
                isJson = true;
            } catch (err) {
                console.log(`Failed to parse JSON data: ${textData}`);
            }
            if (!response.ok) {
                let msg = data;
                if (data.message) {
                    msg = data.message;
                } else if (isJson) {
                    msg = JSON.stringify(data, null, 2);
                }
                return Promise.reject(new Error(
                    `Failed to get data from ${uri}: ${response.status} ${response.statusText}\n${msg}`
                ));
            }
            return data;
        });
};
const getJSON = endPoint => safeFetch(`${endPointUrl}/${endPoint}`);

let navBar;

let editor = null;

let outputElem;

const dispOutput = (output) => {
    if (output.length > 0) {
        console.log(output);
    }
    if (outputElem) {
        outputElem.innerText = output;
    }
};

const multipartUpload = (file) => {
    const CHUNK_SIZE = 1000000;
    const uploadPart = (start, end) => {
        const opts = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Range': `${start}-${end}/${file.size}`,
                'Content-Length': (end - start) + 1,
                Connection: 'keep-alive'
            },
            body: file.slice(start, end + 1, 'application/octet-stream')
        };
        return safeFetch(`/mgmt/shared/file-transfer/uploads/${file.name}`, opts)
            .then(() => {
                if (end === file.size - 1) {
                    return Promise.resolve();
                }
                const nextStart = start + CHUNK_SIZE;
                const nextEnd = (end + CHUNK_SIZE > file.size - 1) ? file.size - 1 : end + CHUNK_SIZE;
                return uploadPart(nextStart, nextEnd);
            })
            .catch(e => Promise.reject(new Error(`Failed to upload file: ${e.stack}`)));
    };

    if (CHUNK_SIZE < file.size) {
        return uploadPart(0, CHUNK_SIZE - 1);
    }
    return uploadPart(0, file.size - 1);
};


const newEditor = (tmplid, view) => {
    const formElement = document.getElementById('form-div');
    if (editor) {
        editor.destroy();
    }

    dispOutput(`Loading template: ${tmplid}`);
    getJSON(`templates/${tmplid}`)
        .catch(e => Promise.reject(new Error(`Error loading template "${tmplid}":\n${e.message}`)))
        .then(data => Template.fromJson(data))
        .then((tmpl) => {
            const schema = JSON.parse(JSON.stringify(tmpl.getParametersSchema())); // Deep copy schema before modifying
            dispOutput(`Creating editor with schema:\n${JSON.stringify(schema, null, 2)}`);

            // Prep the schema for JSON editor
            guiUtils.modSchemaForJSONEditor(schema);
            dispOutput(`Schema modified for the editor:\n${JSON.stringify(schema, null, 2)}`);

            // Create a new editor
            const defaults = guiUtils.filterExtraProperties(tmpl.getCombinedParameters(view), schema);
            // eslint-disable-next-line no-undef
            editor = new JSONEditor(formElement, {
                schema,
                startval: defaults,
                compact: true,
                show_errors: 'always',
                disable_edit_json: true,
                disable_properties: true,
                disable_collapse: true,
                array_controls_top: true,
                theme: 'spectre',
                iconlib: 'fontawesome5'
            });
            dispOutput('Editor loaded'); // Clear text on new editor load

            editor.on('ready', () => {
                dispOutput('Editor ready');

                // Enable form button now that the form is ready
                document.getElementById('view-tmpl-btn').disabled = false;
                document.getElementById('view-schema-btn').disabled = false;
                document.getElementById('view-view-btn').disabled = false;
                document.getElementById('view-render-btn').disabled = false;
                document.getElementById('form-btn').disabled = false;
            });

            editor.on('change', () => {
                document.getElementById('form-btn').disabled = editor.validation_results.length !== 0;
            });

            // Hook up buttons
            document.getElementById('view-tmpl-btn').onclick = () => {
                dispOutput(tmpl.templateText);
            };
            document.getElementById('view-schema-btn').onclick = () => {
                dispOutput(JSON.stringify(schema, null, 2));
            };
            document.getElementById('view-view-btn').onclick = () => {
                dispOutput(JSON.stringify(tmpl.getCombinedParameters(editor.getValue()), null, 2));
            };
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
                safeFetch(`${endPointUrl}/applications`, data)
                    .then((result) => {
                        dispOutput(JSON.stringify(result, null, 2));
                    })
                    .then(() => {
                        window.location.href = '#tasks';
                    })
                    .catch(e => dispOutput(`Failed to submit application:\n${e.message}`));
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
    const rawUrl = window.location.hash.slice(1) || '';
    const url = rawUrl.replace(/\/application.*?\/edit/, '');
    const urlParts = url.split('/');
    const routeInfo = routes[urlParts[0]];

    if (!navBar) navBar = new NavigationBar(urlParts[0]);
    else navBar.selectNavBtn(urlParts[0]);

    // render app
    const app = document.getElementById('app');

    // Remove old content
    while (app.firstChild) {
        app.firstChild.remove();
    }

    const loader = UI.buildLoader();
    app.insertAdjacentElement('beforebegin', loader);

    // Error on unknown route
    if (!routeInfo) {
        const msg = `Could not find route info for url: ${url} (raw was ${rawUrl}, routes: ${Object.keys(routes).join(',')})`;
        app.innerText = msg;
        console.error(msg);
        return;
    }

    // Load new page
    const pageId = `#page-${routeInfo.pageName}`;
    const pageTmpl = document.querySelector(pageId);
    app.appendChild(document.importNode(pageTmpl.content, true));
    app.style.display = 'none';
    outputElem = document.getElementById('output');

    const pageFunc = routeInfo.pageFunc || (() => Promise.resolve());
    pageFunc(urlParts.slice(1).join('/'))
        .finally(() => {
            navBar.renderComplete();
            UI.destroyElem(loader);
            app.style.display = 'block';
        });
}

window.addEventListener('hashchange', router);
window.addEventListener('load', router);

// Define routes
route('', 'apps', () => {
    const appListDiv = document.getElementById('app-list');
    let lastTenant = '';
    dispOutput('Fetching applications list');
    return getJSON('applications')
        .then((appsList) => {
            appListDiv.appendChild(UI.buildRow('app-list-header-row', ['th-row'], ['Tenant', 'Application', 'Template', 'Actions']));
            appsList.forEach((app) => {
                const appPair = [app.tenant, app.name];
                const appPairStr = `${appPair.join('/')}`;

                let appTenant = '';
                if (appPair[0] !== lastTenant) {
                    appTenant = appPair[0];
                    lastTenant = appPair[0];
                }
                const appName = appPair[1];
                const appTemplate = app.template;

                const modifyIconBtn = UI.buildClickable('icon:fa-edit', '', `#modify/${appPairStr}`);

                const deleteBtn = UI.buildClickable('icon:fa-trash', '', '', () => {
                    const theApp = document.getElementById('app');

                    const modal = UI.buildModal(() => {
                        dispOutput(`Deleting ${appPairStr}`);
                        safeFetch(`${endPointUrl}/applications/${appPairStr}`, {
                            method: 'DELETE'
                        })
                            .then(() => {
                                window.location.href = '#tasks';
                            })
                            .catch(e => dispOutput(`Failed to delete ${appPairStr}:\n${e.stack}`));
                    }, `Application '${appPairStr}' will be permanently deleted!`);
                    theApp.appendChild(modal);
                });
                const modifyBtnTooltipped = UI.buildTooltippedElem(modifyIconBtn, 'Modify Application');
                const deleteBtnTooltipped = UI.buildTooltippedElem(deleteBtn, 'Delete Application');

                const actionsDiv = UI.buildDiv(['td'], '', [modifyBtnTooltipped, deleteBtnTooltipped]);

                appListDiv.appendChild(UI.buildRow('app-list-row', ['tr'], [appTenant, appName, appTemplate, actionsDiv]));
            });

            dispOutput('');
        })
        .catch(e => dispOutput(`Error fetching applications: ${e.message}`));
});
route('create', 'create', () => {
    const addTmplBtns = (sets) => {
        const elem = document.getElementById('tmpl-btns');
        sets.forEach((setData) => {
            const row = UI.buildDiv();
            elem.appendChild(row);
            setData.templates.map(x => x.name).forEach((item) => {
                const btn = UI.buildClickable('button', ['btn', 'btn-template'], '', () => {
                    newEditor(item);
                }, item);
                row.appendChild(btn);
            });
        });
    };
    dispOutput('Fetching templates');
    return getJSON('templatesets')
        .then((data) => {
            addTmplBtns(data);
            dispOutput('');
        })
        .catch(e => dispOutput(e.message));
});
route('modify', 'create', (appID) => {
    dispOutput(`Fetching app data for ${appID}`);
    return getJSON(`applications/${appID}`)
        .then((appData) => {
            const appDef = appData.constants.fast;
            newEditor(appDef.template, appDef.view);
        })
        .catch(e => dispOutput(e.message));
});
route('tasks', 'tasks', () => {
    const renderTaskList = () => getJSON('tasks')
        .then((data) => {
            const taskList = document.getElementById('task-list');
            while (taskList.firstChild) {
                taskList.lastChild.remove();
            }
            taskList.appendChild(UI.buildRow('', ['th-row'], ['Task ID', 'Tenant', 'Result']));

            data.forEach((item) => {
                taskList.appendChild(UI.buildRow('app-list-row', ['tr'], [item.id, `${item.tenant}/${item.application}`, item.message]));
            });

            const inProgressJob = (
                data.filter(x => x.message === 'in progress').length !== 0
            );
            if (inProgressJob) {
                setTimeout(renderTaskList, 5000);
            }
        });

    return renderTaskList();
});
route('api', 'api', () => Promise.resolve());
route('templates', 'templates', () => {
    dispOutput('...Loading Template List...');
    const templateDiv = document.getElementById('template-list');

    document.getElementById('add-ts-btn').onclick = () => {
        document.getElementById('ts-file-input').click();
    };
    document.getElementById('ts-file-input').onchange = () => {
        const file = document.getElementById('ts-file-input').files[0];
        const tsName = file.name.slice(0, -4);
        dispOutput(`Uploading file: ${file.name}`);
        multipartUpload(file)
            .then(() => dispOutput(`Installing template set ${tsName}`))
            .then(() => safeFetch('/mgmt/shared/fast/templatesets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: file.name.slice(0, -4)
                })
            }))
            .then(() => {
                dispOutput(`${tsName} installed successfully`);
                window.location.reload();
            })
            .catch(e => dispOutput(`Failed to install ${tsName}:\n${e.message}`));
    };

    return Promise.all([
        getJSON('applications'),
        getJSON('templatesets')
    ])
        .then(([applications, templatesets]) => {
            const setMap = templatesets.reduce((acc, curr) => {
                acc[curr.name] = curr;
                return acc;
            }, {});

            // build dictionary of app lists, keyed by template
            const appDict = applications.reduce((a, c) => {
                if (c.template) {
                    if (!a[c.template]) {
                        a[c.template] = [];
                    }
                    a[c.template].push(c);
                }
                return a;
            }, {});

            const createRow = (rowName, rowList, actionsList, isGroupRow) => {
                rowList = rowList || [];
                actionsList = actionsList || [];
                rowName = rowName.replace(/&nbsp;/g, ' ');

                const row = UI.buildDiv(['tr'], rowName);

                if (isGroupRow) row.classList.add('row-dark');
                else row.classList.add('row-light');

                const name = UI.buildDiv(['td']);
                name.innerHTML = `${rowName}&nbsp`;

                if (isGroupRow) {
                    if (rowList[0] === 'supported') {
                        const f5Icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                        f5Icon.classList.add('f5-icon');
                        const f5Elem = UI.buildTooltippedElem(f5Icon, 'Template Set Supported by F5');
                        f5Elem.classList.add('tooltipped-f5-icon');
                        name.appendChild(f5Elem);
                    }
                    name.style.fontSize = '.8rem';
                    name.style.color = 'rgba(48, 55, 66, .85)';
                }
                row.appendChild(name);

                const applist = UI.buildDiv(['td']);

                if (!isGroupRow) {
                    if (rowList.length > 2) {
                        const appDiv = document.createElement('div');
                        appDiv.innerText = '*click to view*';
                        appDiv.style.fontStyle = 'italic';

                        row.classList.add('clickable');
                        row.onclick = () => {
                            const appListTd = document.getElementById(rowName).children[1];
                            const toggled = appListTd.innerText !== '*click to view*';

                            while (appListTd.firstChild) {
                                appListTd.lastChild.remove();
                            }

                            if (!toggled) {
                                rowList.forEach((item) => {
                                    const appDiv2 = document.createElement('div');
                                    appDiv2.innerText = item;
                                    appDiv2.style.fontSize = '.6rem';
                                    appListTd.style.fontStyle = 'normal';
                                    appListTd.appendChild(appDiv2);
                                });
                            } else {
                                appListTd.innerText = '*click to view*';
                                appListTd.style.fontStyle = 'italic';
                            }
                        };
                        applist.appendChild(appDiv);
                    } else {
                        rowList.forEach((item) => {
                            const appDiv = document.createElement('div');
                            appDiv.innerText = item;
                            applist.appendChild(appDiv);
                        });
                    }
                }

                row.appendChild(applist);

                const actions = UI.buildDiv(['td']);

                Object.entries(actionsList).forEach(([actName, actFn]) => {
                    const iconClass = (actName.toLowerCase() === 'update') ? 'fa-edit' : 'fa-trash';
                    const iconBtn = UI.buildClickable(`icon:${iconClass}`, '', '', actFn);
                    actions.appendChild(UI.buildTooltippedElem(iconBtn, `${actName} Template Set`));
                });
                row.appendChild(actions);

                templateDiv.appendChild(row);
            };

            Object.values(setMap).forEach((setData) => {
                const setName = setData.name;
                const setActions = {
                    Remove: () => {
                        const app = document.getElementById('app');
                        app.appendChild(UI.buildModal(() => {
                            dispOutput(`Deleting ${setName}`);
                            return safeFetch(`${endPointUrl}/templatesets/${setName}`, {
                                method: 'DELETE'
                            })
                                .then(() => {
                                    dispOutput(`${setName} deleted successfully`);
                                    window.location.reload();
                                })
                                .catch(e => dispOutput(`Failed to delete ${setName}:\n${e.stack}`));
                        }, `Template Set '${setName}' is about to be removed!`));
                    }
                };

                if (setData.updateAvailable) {
                    setActions.Update = () => {
                        const app = document.getElementById('app');
                        app.appendChild(UI.buildModal(() => {
                            dispOutput(`Updating ${setName}`);
                            return safeFetch(`${endPointUrl}/templatesets/${setName}`, {
                                method: 'DELETE'
                            })
                                .then(() => safeFetch(`${endPointUrl}/templatesets`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        name: setName
                                    })
                                }))
                                .then(() => {
                                    dispOutput(`${setName} installed successfully`);
                                    window.location.reload();
                                })
                                .catch(e => dispOutput(`Failed to install ${setName}:\n${e.stack}`));
                        }, `Template Set '${setName}' is about to be updated!`));
                    };
                }

                createRow(setName, (setData.supported) ? ['supported'] : [], setActions, true);
                setMap[setName].templates.forEach((tmpl) => {
                    const templateName = tmpl.name;
                    const appList = appDict[templateName] || [];
                    createRow(`&nbsp;&nbsp;&nbsp;&nbsp;/${templateName}`, appList.map(app => `${app.tenant} ${app.name}`));
                });
            });
        })
        .then(() => dispOutput(''));
});
