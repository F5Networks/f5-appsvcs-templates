<template>
    <div id="page-create">
        <div
            id="form-header"
            class="clearfix"
        >
            <div id="header-btns">
                <button
                    id="btn-form-submit"
                    type="button"
                    class="btn btn-primary"
                    disabled
                >
                    Deploy
                </button>
                <router-link
                    v-slot="{ navigate }"
                    :to="backTo"
                >
                    <button
                        type="button"
                        class="btn"
                        @click="navigate"
                        @keypress.enter="navigate"
                    >
                        Cancel
                    </button>
                </router-link>
            </div>
            <h4>{{ title }}</h4>
            <p>{{ description }}</p>
        </div>
        <editor ref="editor" />
        <div id="form-div" />
        <div class="divider" />
        <div
            id="debug-panel"
            class="p-1 column col-auto"
        >
            <div class="accordion">
                <input
                    id="debug-collapse"
                    type="checkbox"
                    name="accordion-checkbox"
                    hidden
                    @click="debugCollapsed = !debugCollapsed"
                >
                <label
                    class="accordion-header c-hand"
                    for="debug-collapse"
                >
                    <i :class="[debugCollapsed ? 'fa-chevron-down' : 'fa-chevron-up', 'fas']" />
                    <div id="panel-header">Debug View</div>
                </label>
                <div class="accordion-body panel">
                    <nav class="panel-nav">
                        <ul class="tab">
                            <li
                                v-for="(tab) in ['Template', 'Schema', 'Inputs', 'Rendered']"
                                :id="'view-' + tab.toLowerCase() + '-tab'"
                                :key="tab"
                                class="tab-item c-hand"
                                :class="{active: activeDebugTab === tab}"
                            >
                                <a class="text-bold">
                                    {{ tab }}
                                </a>
                            </li>
                        </ul>
                    </nav>
                    <div class="panel-body">
                        <div>
                            <pre class="code">
                                <code id="debug-output-text">{{ debugText }}</code>
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
/* eslint-disable no-console */

import Editor from '../components/Editor.vue';

const { Template, guiUtils } = require('@f5devcentral/f5-fast-core');

export default {
    name: 'PageCreate',
    components: {
        Editor
    },
    beforeRouteLeave(to, from, next) {
        this.$root.forceNav();
        next();
    },
    data() {
        return {
            title: '',
            description: '',
            backTo: '',
            debugCollapsed: true,
            debugText: '',
            activeDebugTab: 'Template'
        };
    },
    watch: {
        $route(to) {
            this.update(to.params);
        }
    },
    async created() {
        await this.update(this.$route.params)
            .then(() => {
                this.$root.busy = false;
            });
    },
    methods: {
        currentSet(setName) {
            this.sets.forEach((set) => {
                set.expanded = set.name === setName;
            });
        },
        update(params) {
            this.sets = [];

            let promiseChain = Promise.resolve();
            let template;
            let parameters;
            let existingApp;

            if (params.appid) {
                // Modify
                const appid = params.appid;
                this.$root.forceNav('applications');
                this.backTo = '/applications';
                promiseChain = promiseChain
                    .then(() => this.$root.dispOutput(`Fetching app data for ${appid}`))
                    .then(() => this.$root.getJSON(`applications/${appid}`))
                    .then((appData) => {
                        const appDef = appData.constants.fast;
                        template = appDef.template;
                        parameters = appDef.view;
                        existingApp = appDef;
                    });
            } else if (params.taskid) {
                // Resubmit
                const taskid = params.taskid;
                const submissionData = this.$root.getSubmissionData();
                if (!submissionData[taskid]) {
                    this.$root.dispOutput(`Could not find submission data for task ${taskid}`);
                    return Promise.resolve();
                }

                this.$root.forceNav('tasks');
                this.backTo = '/tasks';
                template = submissionData[taskid].template;
                parameters = submissionData[taskid].parameters;
            } else {
                // Create
                this.$root.forceNav('templates');
                this.backTo = '/templates';
                template = params.tmplid;
            }

            return promiseChain
                .then(() => this.newEditor(template, parameters, existingApp, this))
                .catch(e => this.$root.dispOutput(e.message));
        },
        newEditor(tmplid, view, existingApp, component) {
            const editorComponent = this.$refs.editor;
            this.$root.dispOutput(`Loading template: ${tmplid}`);
            this.$root.getJSON(`templates/${tmplid}`)
                .catch(e => Promise.reject(new Error(`Error loading template "${tmplid}":\n${e.message}`)))
                .then(data => Template.fromJson(data))
                .then((tmpl) => {
                    // Get schema and modify it work better with JSON Editor
                    const schema = guiUtils.modSchemaForJSONEditor(tmpl.getParametersSchema());

                    // Bring the title and description into the header
                    if (component) {
                        component.title = schema.title || '';
                        component.description = schema.description || '';

                        delete schema.title;
                        delete schema.description;
                    }

                    // Prep IPAM fields for existing applications
                    if (existingApp) {
                        Object.entries(schema.properties || {}).forEach(([propName, prop]) => {
                            if (!prop.immutable) {
                                if (prop.type === 'array' && prop.items.oneOf) {
                                    const ipamProp = prop.items.oneOf.find(i => i.ipFromIpam === true);
                                    if (typeof ipamProp !== 'undefined') {
                                        let ipamAddrs = [];
                                        Object.values(existingApp.ipamAddrs).forEach((addrs) => {
                                            ipamAddrs = ipamAddrs.concat(addrs);
                                        });
                                        view[propName] = view[propName].map((item) => {
                                            if (ipamAddrs.indexOf(item) > -1) {
                                                return null;
                                            }
                                            return item;
                                        });
                                    }
                                } else if (prop.ipFromIpam) {
                                    prop.description = `${prop.description} | Current: ${view[propName]}`;
                                    delete view[propName];
                                }
                            }
                        });
                    }

                    // Create a new editor
                    editorComponent.init(schema, tmpl.getCombinedParameters(view));
                    const editor = editorComponent.editor;

                    editor.on('ready', () => {
                        // Enable form button now that the form is ready
                        document.getElementById('btn-form-submit').disabled = false;
                        Object.values(editor.editors).forEach((ed) => {
                            if (!ed) {
                                return;
                            }

                            if (existingApp && ed.schema.immutable) {
                                ed.disable();
                            }

                            if (ed.schema.enum && ed.schema.enum[0] === null) {
                                ed.disable();
                            }
                        });
                        this.$root.dispOutput('');
                    });

                    editor.on('change', () => {
                        document.getElementById('btn-form-submit').disabled = editor.validation_results.length !== 0;
                        // refresh debug content, ensure default tab selected
                        this.activeDebugTab = this.activeDebugTab || 'Template';
                        document.getElementById(`view-${this.activeDebugTab.toLowerCase()}-tab`).click();
                    });

                    // Hook up debug panel
                    const setTabElements = (name, output) => {
                        this.debugText = output;
                        this.activeDebugTab = name;
                    };
                    document.getElementById('view-template-tab').onclick = () => setTabElements.call(this, 'Template', tmpl.sourceText);
                    document.getElementById('view-schema-tab').onclick = () => setTabElements.call(this, 'Schema', JSON.stringify(schema, null, 2));
                    document.getElementById('view-inputs-tab').onclick = () => setTabElements.call(
                        this,
                        'Inputs',
                        JSON.stringify(
                            tmpl.getCombinedParameters(editor.getValue()),
                            null,
                            2
                        )
                    );
                    document.getElementById('view-rendered-tab').onclick = () => {
                        let msg;
                        setTabElements('Rendered', 'Rendering...');
                        this.$root.safeFetch(`${this.$root.endPointUrl}/render`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                name: tmplid,
                                parameters: editor.getValue()
                            })
                        })
                            .then(data => JSON.stringify(data.message[0].appDef, null, 2))
                            .then((rendered) => {
                                msg = [
                                    'WARNING: The below declaration is only for inspection and debug purposes. Submitting the ',
                                    'below ouput to AS3 directly can result in loss of tenants\nand applications. Please only ',
                                    'submit this declaration through FAST.\n\n',
                                    rendered
                                ].join('');
                            })
                            .catch((e) => {
                                msg = `ERROR: Failed to render template. Details:\n${e.message}`;
                            })
                            .finally(() => setTabElements('Rendered', msg));
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
                                parameters,
                                previousDef: existingApp,
                                allowOverwrite: !!existingApp
                            })
                        };
                        this.$root.busy = true;
                        console.log(JSON.stringify(data, null, 2));
                        Promise.resolve()
                            .then(() => this.$root.safeFetch(`${this.$root.endPointUrl}/applications`, data))
                            .then((result) => {
                                console.log(JSON.stringify(result, null, 2));

                                const submissionData = this.$root.getSubmissionData();
                                const taskid = result.message[0].id;
                                submissionData[taskid] = {
                                    template: tmplid,
                                    parameters
                                };
                                this.$root.storeSubmissionData(submissionData);
                            })
                            .then(() => {
                                this.$root.$router.push('/tasks');
                            })
                            .catch((e) => {
                                this.$root.busy = false;
                                this.$root.dispOutput(`Failed to submit application:\n${e.message}`);
                            });
                    };

                    console.log('Editor loaded'); // Clear text on new editor load
                })
                .catch((e) => {
                    const versionError = e.message.match(/^.*(since it requires (AS3|BIG-IP)|due to missing modules).*$/m);
                    if (versionError) {
                        this.$root.dispOutput(versionError[0].replace('&gt;', '>'));
                    } else {
                        this.$root.dispOutput(`Error loading editor:\n${e.message}`);
                    }
                });
        }
    }
};
</script>

<style scoped>
#form-header {
  background-color: #eae9e5;
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0.5em;
  border-bottom: 2px solid #c4c4c4;
}

#header-btns {
  float: right;
}

#panel-header {
    display: inline-block;
    color: inherit;
    font-weight: 500;
    line-height: 1.2;
    margin-bottom: .5em;
    margin-top: 0;
    font-size: 0.8rem;
}
</style>
