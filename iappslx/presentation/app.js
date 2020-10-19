/* global Vue, JSONEditor */
/* eslint-env browser */
/* eslint-disable no-console */

'use strict';

// eslint-disable-next-line import/no-extraneous-dependencies
const marked = require('marked');
const { Template, guiUtils } = require('@f5devcentral/f5-fast-core');

const UiWorker = require('./lib/ui-worker.js');

const endPointUrl = '/mgmt/shared/fast';

const wait = delay => new Promise(resolve => setTimeout(resolve, delay));

const safeFetch = (uri, opts, numAttempts) => {
    numAttempts = numAttempts || 0;

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
                const retry = (
                    response.status === 404
                    && (
                        data.errorStack
                        || (data.message && data.message.match(/Public URI path not registered/))
                    )
                    && (!numAttempts || numAttempts < 5)
                );
                if (retry) {
                    numAttempts += 1;
                    console.log(`attempting retry ${numAttempts} to ${uri}`);
                    return Promise.resolve()
                        .then(() => wait(1000))
                        .then(() => safeFetch(uri, opts, numAttempts));
                }
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
let UI;

const appState = {
    debugOutput: '',
    data: {},
    modal: {
        message: '',
        icon: ''
    },
    pageComponent: {
        template: '<div></div>'
    },
    busy: true
};

// Auto-register HTML template tags as Vue components
// eslint-disable-next-line no-restricted-syntax
for (const tmpl of document.getElementsByTagName('template')) {
    Vue.component(tmpl.id, {
        props: ['data'],
        template: `#${tmpl.id}`
    });
}
// eslint-disable-next-line no-unused-vars
const vueApp = new Vue({
    el: '#vue-app',
    data: appState,
    methods: {
        cancelModal() {
            appState.modal.message = '';
        },
        continueModal() {
            const modalFunc = window.modalFunc || Promise.resolve();
            Promise.resolve()
                .then(() => modalFunc())
                .finally(() => this.cancelModal());
        },
        showModal(type, msg, func) {
            if (type === 'warning') {
                appState.modal.icon = 'info-warning';
                appState.modal.title = 'Warning';
            } else {
                appState.modal.icon = 'info-circle';
                appState.modal.title = 'Info';
            }
            window.modalFunc = func;
            appState.modal.message = msg;
        }
    }
});

const dispOutput = (output) => {
    if (output.length > 0) {
        console.log(output);
    }
    appState.debugOutput = output;
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

const storeSubmissionData = (data) => {
    UiWorker.store('submission-data', JSON.stringify(data));
};

const getSubmissionData = () => {
    const submissionData = UiWorker.getStore('submission-data') || '{}';
    return JSON.parse(submissionData);
};

// eslint-disable-next-line no-undef
class Base64Editor extends JSONEditor.defaults.editors.string {
    setValue(val) {
        if (val) {
            val = Buffer.from(val, 'base64').toString('utf8');
        }
        super.setValue(val);
    }

    getValue() {
        let retval = super.getValue();
        if (retval) {
            retval = Buffer.from(retval).toString('base64');
        }
        return retval;
    }
}

// eslint-disable-next-line no-undef
JSONEditor.defaults.editors.base64 = Base64Editor;

// eslint-disable-next-line no-undef
JSONEditor.defaults.resolvers.unshift((schema) => {
    if (schema.type === 'string' && schema.contentEncoding === 'base64') {
        return 'base64';
    }

    return undefined;
});

class InfoEditor extends JSONEditor.defaults.editors.info {
    build() {
        // Modify build to use getFormInputDescription() so we get descriptions
        // with the je-desc class. This allows our Markdown rendering to work with
        // the info editor
        this.options.compact = false;
        // eslint-disable-next-line no-multi-assign
        this.header = this.label = this.theme.getFormInputLabel(this.getTitle());
        this.description = this.theme.getFormInputDescription(this.schema.description || '');
        this.control = this.theme.getFormControl(this.label, this.description, null);
        this.container.appendChild(this.control);
    }
}
JSONEditor.defaults.editors.info = InfoEditor;

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
            // Get schema and modify it work better with JSON Editor
            const schema = guiUtils.modSchemaForJSONEditor(tmpl.getParametersSchema());

            // Create a new editor
            const defaults = guiUtils.filterExtraProperties(tmpl.getCombinedParameters(view), schema);
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
                // Render Markdown in descriptions
                const descElements = document.getElementsByClassName('je-desc');
                Array.prototype.map.call(descElements, (elem) => {
                    // Get raw schema description since the element text has newlines stripped
                    const schemaPath = elem.parentElement.parentElement.getAttribute('data-schemapath');
                    const propEd = editor.getEditor(schemaPath);
                    const md = propEd.schema.description || '';

                    let html = marked(md);
                    if (html.startsWith('<p>')) {
                        html = html.substring(3, html.length);
                    }
                    if (html.endsWith('</p>')) {
                        html = html.substring(0, html.length - 5);
                    }
                    elem.innerHTML = html;
                });
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
                dispOutput(tmpl.render(editor.getValue()));
            };
            document.getElementById('btn-form-submit').onclick = () => {
                const parameters = editor.getValue();
                const data = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: tmplid,
                        parameters
                    })
                };
                appState.busy = true;
                dispOutput(JSON.stringify(data, null, 2));
                Promise.resolve()
                    .then(() => safeFetch(`${endPointUrl}/applications`, data))
                    .then((result) => {
                        dispOutput(JSON.stringify(result, null, 2));

                        const submissionData = getSubmissionData();
                        const taskid = result.message[0].id;
                        submissionData[taskid] = {
                            template: tmplid,
                            parameters
                        };
                        storeSubmissionData(submissionData);
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
    appState.busy = true;
    UI.startMoveToRoute(urlParts[0]);

    // Error on unknown route
    if (!routeInfo) {
        const msg = `Could not find route info for url: ${url} (raw was ${rawUrl}, routes: ${Object.keys(routes).join(',')})`;
        app.innerText = msg;
        console.error(msg);
        return;
    }

    // Load new page
    dispOutput('');
    appState.pageComponent = `page-${routeInfo.pageName}`;

    const pageFunc = routeInfo.pageFunc || (() => Promise.resolve());
    Promise.resolve()
        .then(() => pageFunc(urlParts.slice(1).join('/')))
        .finally(() => {
            UI.completeMoveToRoute();
            appState.busy = false;
        });
}

window.addEventListener('hashchange', router);
window.addEventListener('load', router);

// Define routes
route('', 'apps', () => {
    vueApp.$refs.page.deleteApplication = (appPath) => {
        vueApp.showModal(
            'warning',
            `Application ${appPath} will be permanently deleted!`,
            () => {
                appState.busy = true;
                dispOutput(`Deleting ${appPath}`);
                return Promise.resolve()
                    .then(() => safeFetch(`${endPointUrl}/applications/${appPath}`, {
                        method: 'DELETE'
                    }))
                    .then(() => {
                        window.location.href = '#tasks';
                    })
                    .catch(e => dispOutput(`Failed to delete ${appPath}:\n${e.message}`));
            }
        );
    };

    appState.data = {
        appsList: []
    };

    return getJSON('applications')
        .then((appsList) => {
            appsList.forEach((app) => {
                app.path = `${app.tenant}/${app.name}`;
            });
            appState.data.appsList = appsList;
            dispOutput('');
        })
        .catch(e => dispOutput(`Error fetching applications: ${e.message}`));
});
route('create', 'create', () => {
    vueApp.$refs.page.newEditor = (tmplid) => {
        newEditor(tmplid);
    };

    vueApp.$refs.page.currentSet = (setName) => {
        appState.data.sets.forEach((set) => {
            set.expanded = set.name === setName;
        });
    };

    appState.data = {
        sets: []
    };
    return getJSON('templatesets')
        .then((data) => {
            appState.data.sets = data.map(x => Object.assign({}, x, { expanded: false }));
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
route('resubmit', 'create', (taskid) => {
    const submissionData = getSubmissionData();
    if (!submissionData[taskid]) {
        dispOutput(`Could not find submission data for task ${taskid}`);
        return Promise.resolve();
    }

    const template = submissionData[taskid].template;
    const parameters = submissionData[taskid].parameters;

    return Promise.resolve()
        .then(() => newEditor(template, parameters))
        .catch(e => dispOutput(e.message));
});
route('tasks', 'tasks', () => {
    const submissionData = getSubmissionData();
    const renderTaskList = () => getJSON('tasks')
        .then((tasks) => {
            tasks.forEach((task) => {
                task.errMsg = '';
                if (task.message.includes('Error:')) {
                    task.errMsg = task.message.replace(/Error:/);
                    task.message = 'Error';
                } else if (task.message.includes('declaration failed')) {
                    task.errMsg = task.message.replace(/declaration failed/);
                    task.message = 'declaration failed';
                } else if (task.message.includes('declaration is invalid')) {
                    task.errMsg = task.message.replace(/declaration is invalid/);
                    task.message = 'declaration is invalid';
                }
                task.showPopover = false;
                if (task.message === 'success' && submissionData[task.id]) {
                    delete submissionData[task.id];
                    storeSubmissionData(submissionData);
                }

                if (submissionData[task.id]) {
                    task.canResubmit = true;
                }
            });
            appState.data.tasks = tasks;

            const inProgressJob = (
                tasks.filter(x => x.message === 'in progress').length !== 0
            );
            if (inProgressJob) {
                setTimeout(renderTaskList, 5000);
            }
        });

    appState.data = {
        tasks: []
    };
    return renderTaskList();
});
route('api', 'api', () => Promise.resolve());
route('templates', 'templates', () => {
    const filters = {
        enabled: 'Enabled',
        f5: 'F5 Supported',
        disabled: 'Disabled',
        all: 'All Template Sets'
    };
    const templatesFilterKey = 'templates-filter';
    let currentFilter = UiWorker.getStore(templatesFilterKey);
    if (!currentFilter) {
        currentFilter = 'enabled';
    }

    const renderTemplates = () => Promise.resolve()
        .then(() => Promise.all([
            getJSON('applications'),
            getJSON('templatesets'),
            getJSON('templatesets?showDisabled=true')
        ]))
        .then(([applications, templatesets, disabledTemplateSets]) => {
            const allTemplates = templatesets
                .concat(disabledTemplateSets)
                .filter(x => (
                    (currentFilter === 'all')
                    || (currentFilter === 'f5' && x.supported)
                    || (currentFilter === 'enabled' && x.enabled)
                    || (currentFilter === 'disabled' && !x.enabled)
                ));

            // build dictionary of app lists, keyed by set
            const appDict = applications.reduce((acc, curr) => {
                const setName = curr.template.split('/')[0];
                if (!acc[setName]) {
                    acc[setName] = [];
                }
                acc[setName].push(curr);
                return acc;
            }, {});

            const setMap = allTemplates.reduce((acc, curr) => {
                const apps = appDict[curr.name] || [];
                acc[curr.name] = Object.assign(curr, {
                    expanded: apps.length < 3,
                    apps
                });
                return acc;
            }, {});

            appState.data.sets = setMap;
            Object.values(setMap).forEach((setData) => {
                if (!setData.enabled && setData.updateAvailable) {
                    console.error('enabled === false && updateAvailable is illegal. Critical Error');
                }
            });
        })
        .then(() => dispOutput(''));

    const reloadTemplates = () => Promise.resolve()
        .then(() => {
            appState.busy = true;
        })
        .then(() => renderTemplates())
        .then(() => {
            appState.busy = false;
        });

    document.getElementById('btn-add-ts').onclick = () => {
        document.getElementById('input-ts-file').click();
    };
    document.getElementById('input-ts-file').onchange = () => {
        const file = document.getElementById('input-ts-file').files[0];
        const tsName = file.name.slice(0, -4);
        appState.busy = true;
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
            })
            .catch(e => dispOutput(`Failed to install ${tsName}:\n${e.message}`))
            .then(() => reloadTemplates());
    };
    document.getElementById('btn-delete-all-ts').onclick = () => {
        vueApp.showModal(
            'warning',
            'All Template Sets will be removed!',
            () => {
                appState.busy = true;
                dispOutput('Deleting All Template Sets');
                return safeFetch(`${endPointUrl}/templatesets`, {
                    method: 'DELETE'
                })
                    .then(() => {
                        dispOutput('All Template Sets deleted successfully');
                    })
                    .catch(e => dispOutput(`Failed to delete all Template Sets. Error: ${e.message}`))
                    .then(() => reloadTemplates());
            }
        );
    };

    vueApp.$refs.page.setFilter = (filter) => {
        currentFilter = filter;
        appState.data.currentFilter = filter;
        UiWorker.store(templatesFilterKey, filter);
        document.getElementById('templates-filter').classList.remove('active'); // Collapse the drop down
        reloadTemplates();
    };

    vueApp.$refs.page.removeSet = (setName) => {
        vueApp.showModal(
            'warning',
            `Template Set '${setName}' will be removed!`,
            () => {
                appState.busy = true;
                dispOutput(`Deleting ${setName}`);
                return Promise.resolve()
                    .then(() => safeFetch(`${endPointUrl}/templatesets/${setName}`, {
                        method: 'DELETE'
                    }))
                    .then(() => {
                        dispOutput(`${setName} deleted successfully`);
                    })
                    .catch(err => dispOutput(`Failed to delete ${setName}:\n${err.message}`))
                    .then(() => reloadTemplates());
            }
        );
    };

    vueApp.$refs.page.installSet = (setName) => {
        vueApp.showModal(
            'info',
            `Template Set '${setName}' will be enabled.`,
            () => {
                appState.busy = true;
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
                    })
                    .catch(err => dispOutput(`Failed to enable ${setName}:\n${err.message}`))
                    .then(() => reloadTemplates());
            }
        );
    };

    vueApp.$refs.page.updateSet = (setName) => {
        vueApp.showModal(
            'warning',
            `Template Set '${setName}' will be updated!`,
            () => {
                appState.busy = true;
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
                    })
                    .catch(err => dispOutput(`Failed to install ${setName}:\n${err.message}`))
                    .then(() => reloadTemplates());
            }
        );
    };

    appState.data = {
        filters,
        currentFilter,
        sets: [],
        apps: {}
    };

    return renderTemplates();
});
