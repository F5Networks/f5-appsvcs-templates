/* eslint-env browser */
/* eslint-disable no-console */

'use strict';


const yaml = require('js-yaml');

const { Template, guiUtils } = require('@f5devcentral/f5-fast-core');

const UiWorker = require('./js/ui-worker.js');
const {
    Div, Span, Clickable, Icon, Row, Loader, Modal, Popover, Td, Expandable, Svg
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
            .catch(e => Promise.reject(new Error(`Failed to upload file: ${e.message}`)));
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
                document.getElementById('btn-form-submit').disabled = false;
            });

            editor.on('change', () => {
                document.getElementById('btn-form-submit').disabled = editor.validation_results.length !== 0;
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
            document.getElementById('btn-form-submit').onclick = () => {
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
                                        .catch(e => dispOutput(`Failed to delete ${appPairStr}:\n${e.message}`));
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
                        .setInnerText(item).setOnClick((e) => { newEditor(item); e.stopPropagation(); })
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
    document.getElementById('btn-add-ts').onclick = () => {
        document.getElementById('input-ts-file').click();
    };
    document.getElementById('input-ts-file').onchange = () => {
        const file = document.getElementById('input-ts-file').files[0];
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
    document.getElementById('btn-delete-all-ts').onclick = () => {
        new Modal().setTitle('Warning').setMessage('All Template Sets will be removed!').setOkFunction(() => {
            dispOutput('Deleting All Template Sets');
            return safeFetch(`${endPointUrl}/templatesets`, {
                method: 'DELETE'
            })
                .then(() => {
                    dispOutput('All Template Sets deleted successfully');
                    window.location.reload();
                })
                .catch(e => dispOutput(`Failed to delete all Template Sets. Error: ${e.message}`));
        })
            .appendToParent(document.getElementById('app'));
    };

    const templatesFilterKey = 'templates-filter';
    const templatesFilterElem = document.getElementById('templates-filter');
    const filterElem = document.getElementById('filter');
    const menu = templatesFilterElem.getElementsByClassName('menu')[0];
    const selected = templatesFilterElem.getElementsByClassName('selected')[0];
    if (!UiWorker.getStore(templatesFilterKey)) {
        UiWorker.store(templatesFilterKey, selected.id);
        console.log('templatesFilter empty in store. Pulled from  stored:', selected.id);
    }

    const curFilter = UiWorker.getStore(templatesFilterKey);
    console.log('curFilter: ', curFilter);
    if (document.getElementById(curFilter).innerText.toLowerCase() !== templatesFilterElem.innerText.toLowerCase()) {
        selected.classList.remove('selected');
        document.getElementById(curFilter).classList.add('selected');
    }

    UiWorker.iterateHtmlCollection(menu, (item) => {
        item.onclick = () => {
            console.log('clicked. templatesFilterKey stored: ', item.id);
            UiWorker.store(templatesFilterKey, item.id);
            window.location.reload();
        };
    });

    filterElem.innerText = document.getElementById(curFilter).innerText;

    const templateDiv = document.getElementById('template-list');
    return Promise.all([
        getJSON('applications'),
        getJSON('templatesets'),
        getJSON('templatesets?showDisabled=true')
    ])
        .then(([applications, templatesets, disabledTemplateSets]) => {
            console.log('applications', applications);
            console.log('templatesets', templatesets);
            console.log('disabledTemplateSets', disabledTemplateSets);
            const filter = document.getElementById('templates-filter').getElementsByClassName('selected')[0].id.toLowerCase();
            const allTemplates = templatesets.concat(disabledTemplateSets);
            console.log('allTemplates:', allTemplates);
            const setMap = allTemplates.reduce((acc, curr) => {
                if (filter === 'all') acc[curr.name] = curr;
                if (filter === 'f5' && curr.supported) acc[curr.name] = curr;
                if (filter === 'enabled' && curr.enabled) acc[curr.name] = curr;
                if (filter === 'disabled' && !curr.enabled) acc[curr.name] = curr;
                return acc;
            }, {});

            console.log('setMap:', setMap);

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

            Object.values(setMap).forEach((setData) => {
                const setName = setData.name;
                const setActions = {
                    Remove: (e) => {
                        new Modal().setTitle('Warning').setMessage(`Template Set '${setName}' will be removed!`).setOkFunction(() => {
                            dispOutput(`Deleting ${setName}`);
                            return safeFetch(`${endPointUrl}/templatesets/${setName}`, {
                                method: 'DELETE'
                            })
                                .then(() => {
                                    dispOutput(`${setName} deleted successfully`);
                                    window.location.reload();
                                })
                                .catch(err => dispOutput(`Failed to delete ${setName}:\n${err.message}`));
                        })
                            .appendToParent(document.getElementById('app'));

                        e.stopPropagation();
                    }
                };

                if (!setData.enabled) {
                    console.log('!setData.enabled. Building Install function');
                    setActions.Install = (e) => {
                        console.log('e:', e);
                        new Modal().setTitle('Enabling Template Set').setMessage(`Template Set '${setName}' will be enabled.`).setOkFunction(() => {
                            dispOutput(`Enabling ${setName}`);
                            return Promise.resolve()
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
                                    dispOutput(`${setName} enabled successfully`);
                                    window.location.reload();
                                })
                                .catch(err => dispOutput(`Failed to enable ${setName}:\n${err.message}`));
                        })
                            .appendToParent(document.getElementById('app'));

                        e.stopPropagation();
                    };
                }

                if (setData.updateAvailable) {
                    setActions.Update = (e) => {
                        new Modal().setTitle('Warning').setMessage(`Template Set '${setName}' will be updated!`).setOkFunction(() => {
                            dispOutput(`Updating ${setName}`);
                            return Promise.resolve()
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
                                .catch(err => dispOutput(`Failed to install ${setName}:\n${err.message}`));
                        })
                            .appendToParent(document.getElementById('app'));

                        e.stopPropagation();
                    };
                }

                if (!setData.enabled && setData.updateAvailable) { console.error('enabled === false && updateAvailable is illegal. Critical Error'); }

                const templateSetRow = new Row('tr row-dark clickable').setId(setName).appendToParent(templateDiv).setColumns([
                    () => {
                        const tempSetName = new Div('td td-template-set').setChildren([
                            new Icon('fa-angle-right').html(),
                            `${setName}&nbsp`
                        ]);
                        const traitsDiv = new Span('traits');
                        if (setData.supported) {
                            new Svg('f5-icon').setToolstrip('Template Set Supported by F5')
                                .setClassList('tooltipped-f5-icon').appendToParent(traitsDiv);
                        }
                        if (setData.enabled) {
                            new Icon('fa-check-circle').setToolstrip('Template Set is Enabled').appendToParent(traitsDiv);
                        } else { // can a template set be removable if it's disabled?
                            new Icon('fa-times-circle').setClassList('red-base-forecolor').setToolstrip('Template Set is Disabled!')
                                .setClassList('tooltip-red')
                                .appendToParent(traitsDiv);
                        }
                        traitsDiv.appendToParent(tempSetName);
                        return tempSetName;
                    },
                    new Td(),
                    () => {
                        const actions = new Td();

                        if (!setData.enabled) {
                            const installBtn = new Clickable('icon:fa-download').setOnClick(setActions.Install).setToolstrip('Install Template Set');
                            actions.safeAppend(installBtn);
                            return actions;
                        }

                        Object.entries(setActions).forEach(([actName, actFn]) => {
                            const iconClass = (actName.toLowerCase() === 'update') ? 'fa-edit' : 'fa-trash';
                            actions.safeAppend(new Clickable(`icon:${iconClass}`).setOnClick(actFn).setToolstrip(`${actName} Template Set`));
                        });
                        return actions;
                    }
                ]);

                const tempSetChild = `${setName}-child`;
                templateSetRow.makeExpandable(tempSetChild);

                if (!setData.enabled) { templateSetRow.setClassList('row-dark-red red-hover'); }

                setMap[setName].templates.forEach((tmpl) => {
                    const templateName = tmpl.name;
                    const appList = appDict[tmpl.name] || [];

                    const templateRow = new Row('tr row-light').setClassList(tempSetChild).appendToParent(templateDiv);
                    templateRow.setColumns([
                        templateName,
                        () => {
                            const applicationsDiv = () => {
                                const applicationsMapped = appList.map(app => `${app.tenant} ${app.name}`);
                                const div = new Div();
                                applicationsMapped.forEach((item) => {
                                    const tenantApp = item.split(' ');
                                    new Div('fontsize-6rem').setChildren([
                                        tenantApp[0],
                                        new Icon('fa-angle-double-right').setClassList('fontsize-5rem').html(),
                                        tenantApp[1]
                                    ]).appendToParent(div);
                                });
                                return div;
                            };

                            const appsTd = new Td().appendToParent(templateRow);
                            if (appList.length < 3) {
                                appsTd.safeAppend(applicationsDiv());
                            } else {
                                appsTd.setClassList('italic').setInnerText('*click to view*');
                                templateRow.setClassList('clickable');
                                templateRow.elem.onclick = () => {
                                    if (appsTd.elem.innerText === '*click to view*') {
                                        UiWorker.destroyChildren(appsTd);
                                        appsTd.elem.innerText = '';
                                        appsTd.elem.classList.remove('italic');
                                        appsTd.safeAppend(applicationsDiv());
                                    } else {
                                        UiWorker.destroyChildren(appsTd.elem);
                                        appsTd.elem.innerText = '*click to view*';
                                        appsTd.elem.classList.add('italic');
                                    }
                                };
                            }
                            return appsTd;
                        },
                        new Td()
                    ]);

                    if (!templateSetRow.elem.classList.contains('expanded')) { templateRow.elem.classList.add('display-none'); }

                    if (!setData.enabled) {
                        templateRow.setClassList('row-light-red grey-forecolor');
                    }
                });
            });
        })
        .then(() => dispOutput(''));
});
