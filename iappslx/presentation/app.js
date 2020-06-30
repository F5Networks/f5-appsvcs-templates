/* eslint-env browser */
/* eslint-disable no-console */

'use strict';


const yaml = require('js-yaml');

const { Template, guiUtils } = require('@f5devcentral/f5-fast-core');

const UiWorker = require('./js/ui-worker.js');
const {
    Div, Clickable, Icon, Row, Loader, Modal, Popover, Td, Expandable, Svg
} = require('./js/elements');

const endPointUrl = '/mgmt/shared/fast';

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

let editor = null;

let outputElem;

let UI;

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

    const app = document.getElementById('app');
    if (!UI) UI = new UiWorker(app);
    UI.startMoveToRoute(urlParts[0]);

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
    app.style.opacity = '.3';
    outputElem = document.getElementById('output');

    const pageFunc = routeInfo.pageFunc || (() => Promise.resolve());
    pageFunc(urlParts.slice(1).join('/'))
        .finally(() => {
            UI.completeMoveToRoute();
            app.style.opacity = '1';
            app.style.display = 'block';
        });
}

window.addEventListener('hashchange', router);
window.addEventListener('load', router);

// Define routes
route('', 'apps', () => {
    const appListDiv = document.getElementById('app-list');
    let lastTenant = '';
    return getJSON('applications')
        .then((appsList) => {
            new Row('th-row').setColumns([new Td('tenant-app-th'), 'Template', 'Actions']).appendToParent(appListDiv);
            new Row().setAttr('height', '1px').appendToParent(appListDiv);
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

                new Row().appendToParent(appListDiv)
                    .setColumn(new Td('tenant-app-td', [appTenant, appName]))
                    .setColumn(appTemplate)
                    .setColumn(new Div('td').setChildren([
                        new Clickable('icon:fa-edit').setHref(`#modify/${appPairStr}`).setToolstrip('Modify Application'),
                        new Clickable('icon:fa-trash').setOnClick(() => {
                            new Modal().setTitle('Warning')
                                .setMessage(`Application '${appPairStr}' will be permanently deleted!`)
                                .setOkFunction(() => {
                                    dispOutput(`Deleting ${appPairStr}`);
                                    safeFetch(`${endPointUrl}/applications/${appPairStr}`, {
                                        method: 'DELETE'
                                    })
                                        .then(() => {
                                            window.location.href = '#tasks';
                                        })
                                        .catch(e => dispOutput(`Failed to delete ${appPairStr}:\n${e.stack}`));
                                })
                                .appendToParent(document.getElementById('app'));
                        }).setToolstrip('Delete Application')
                    ]));
            });
            dispOutput('');
        })
        .catch(e => dispOutput(`Error fetching applications: ${e.message}`));
});
route('create', 'create', () => {
    const addTmplBtns = (sets) => {
        const elem = document.getElementById('tmpl-btns');
        sets.forEach((setData) => {
            const templateSet = new Expandable(setData.name, ['template-set-title', 'clickable']).appendToParent(elem);
            setData.templates.map(x => x.name).forEach((item) => {
                templateSet.addExpandable(
                    new Clickable('button').setClassList(['btn', 'btn-template'])
                        .setInnerText(item).setOnClick(() => { newEditor(item); })
                );
            });
            templateSet.completeSetup();
        });
    };
    return getJSON('templatesets')
        .then((data) => {
            addTmplBtns(data);
            const deployText = document.getElementById('available-text');
            deployText.classList.remove('display-none');
            dispOutput('');
        })
        .catch(e => dispOutput(e.message));
});
route('modify', 'create', (appID) => {
    dispOutput(`Fetching app data for ${appID}`);
    return getJSON(`applications/${appID}`)
        .then((appData) => {
            const availableText = document.getElementById('available-text');
            availableText.classList.add('display-none');
            const appDef = appData.constants.fast;
            newEditor(appDef.template, appDef.view);
        })
        .catch(e => dispOutput(e.message));
});
route('tasks', 'tasks', () => {
    const renderTaskList = () => getJSON('tasks')
        .then((tasks) => {
            const taskList = document.getElementById('task-list');
            UiWorker.destroyChildren(taskList);

            new Row('th-row').appendToParent(taskList)
                .setColumns(['Task ID', new Td('tenant-app-th'), 'Operation', 'Result']);

            new Row().setAttr('height', '1px').appendToParent(taskList);

            tasks.forEach((task) => {
                new Row(task.id).setClassList('tr').appendToParent(taskList)
                    .setColumn(
                        new Clickable().setInnerText(task.id).setHref(`/mgmt/shared/fast/tasks/${task.id}`)
                            .setToolstrip('go to task')
                            .setClassList(['td', 'clickable-darker'])
                    )
                    .setColumn(new Td('tenant-app-td', [task.tenant, task.application]))
                    .setColumn(task.operation)
                    .setColumn(() => {
                        if (task.message === 'in progress') {
                            return new Div('td').setChildren(new Loader().setSize('sm').start().html());
                        }
                        if (task.message === 'success') {
                            return new Div('td').setChildren('success').setClassList('success-color');
                        }
                        if (task.message.includes('Error:') || task.message.includes('declaration failed')) {
                            let title = 'declaration failed';
                            let message = task.message.substring(18, task.message.length);
                            if (task.message.includes('Error:')) { title = 'Error'; message = task.message.split(':')[1]; }
                            const questionIcon = new Icon('fa-question-circle').setClassList(['cursor-default', 'danger-color']).html();
                            const questionPopover = new Popover(questionIcon).setDirection('left').setStyle('danger')
                                .setData(title, message);

                            return new Div('td').setChildren([title, questionPopover]).setClassList('danger-color');
                        }
                        return task.message;
                    });
            });

            const inProgressJob = (
                tasks.filter(x => x.message === 'in progress').length !== 0
            );
            if (inProgressJob) {
                setTimeout(renderTaskList, 5000);
            }
        });


    return renderTaskList();
});
route('api', 'api', () => Promise.resolve());
route('templates', 'templates', () => {
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

                const row = new Row().setId(rowName).appendToParent(templateDiv);

                if (isGroupRow) row.setClassList('row-dark');
                else row.setClassList('row-light');

                const name = new Div('td').setChildren(`${rowName}&nbsp`);

                if (isGroupRow) {
                    if (rowList[0] === 'supported') {
                        new Svg('f5-icon').setToolstrip('Template Set Supported by F5')
                            .setClassList('tooltipped-f5-icon').appendToParent(name);
                    }
                    name.setClassList('td-template-set');
                } else {
                    name.setClassList('td-template');
                }
                row.setColumn(name);

                const applist = new Div('td');

                if (!isGroupRow) {
                    if (rowList.length > 2) {
                        const appDiv = new Div('italic').setInnerText('*click to view*');

                        row.setClassList('clickable');
                        row.elem.onclick = () => {
                            const appListTd = document.getElementById(rowName).children[1];
                            const toggled = appListTd.innerText !== '*click to view*';

                            UiWorker.destroyChildren(appListTd);

                            if (!toggled) {
                                rowList.forEach((item) => {
                                    const tenantApp = item.split(' ');
                                    const appDiv2 = new Div('fontsize-6rem').setChildren([
                                        tenantApp[0],
                                        new Icon('fa-angle-double-right').setClassList('fontsize-5rem').html(),
                                        tenantApp[1]
                                    ]);
                                    appListTd.classList.remove('italic');
                                    appListTd.appendChild(appDiv2.html());
                                });
                            } else {
                                appListTd.innerText = '*click to view*';
                                appListTd.classList.add('italic');
                            }
                        };
                        applist.safeAppend(appDiv.html());
                    } else {
                        rowList.forEach((item) => {
                            const appDiv = document.createElement('div');
                            appDiv.innerText = item;
                            applist.safeAppend(appDiv);
                        });
                    }
                }

                row.setColumn(applist);

                const actions = new Div('td');

                Object.entries(actionsList).forEach(([actName, actFn]) => {
                    const iconClass = (actName.toLowerCase() === 'update') ? 'fa-edit' : 'fa-trash';
                    actions.safeAppend(new Clickable(`icon:${iconClass}`).setOnClick(actFn).setToolstrip(`${actName} Template Set`));
                });
                row.setColumn(actions);
            };

            Object.values(setMap).forEach((setData) => {
                const setName = setData.name;
                const setActions = {
                    Remove: () => {
                        const app = document.getElementById('app');
                        new Modal().setTitle('Warning').setMessage(`Template Set '${setName}' will be removed!`).setOkFunction(() => {
                            dispOutput(`Deleting ${setName}`);
                            return safeFetch(`${endPointUrl}/templatesets/${setName}`, {
                                method: 'DELETE'
                            })
                                .then(() => {
                                    dispOutput(`${setName} deleted successfully`);
                                    window.location.reload();
                                })
                                .catch(e => dispOutput(`Failed to delete ${setName}:\n${e.stack}`));
                        })
                            .appendToParent(app);
                    }
                };

                if (setData.updateAvailable) {
                    setActions.Update = () => {
                        const app = document.getElementById('app');

                        new Modal().setTitle('Warning').setMessage(`Template Set '${setName}' will be updated!`).setOkFunction(() => {
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
                        })
                            .appendToParent(app);
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
