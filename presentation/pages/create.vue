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
        <div
            v-if="showDebug"
            class="text-right"
        >
            <button
                id="view-tmpl-btn"
                type="button"
                disabled
            >
                View Template
            </button>
            <button
                id="view-schema-btn"
                type="button"
                disabled
            >
                View Schema
            </button>
            <button
                id="view-view-btn"
                type="button"
                disabled
            >
                View Inputs
            </button>
            <button
                id="view-render-btn"
                type="button"
                disabled
            >
                View Rendered
            </button>
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
            showDebug: false
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
                .then(() => this.$root.getJSON('settings'))
                .then((config) => {
                    this.showDebug = config.showTemplateDebug;
                })
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
                        if (this.showDebug) {
                            document.getElementById('view-tmpl-btn').disabled = false;
                            document.getElementById('view-schema-btn').disabled = false;
                            document.getElementById('view-view-btn').disabled = false;
                            document.getElementById('view-render-btn').disabled = false;
                        }
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
                    });

                    editor.on('change', () => {
                        document.getElementById('btn-form-submit').disabled = editor.validation_results.length !== 0;
                    });

                    // Hook up buttons
                    if (this.showDebug) {
                        document.getElementById('view-tmpl-btn').onclick = () => {
                            this.$root.dispOutput(tmpl.sourceText);
                        };
                        document.getElementById('view-schema-btn').onclick = () => {
                            this.$root.dispOutput(JSON.stringify(schema, null, 2));
                        };
                        document.getElementById('view-view-btn').onclick = () => {
                            this.$root.dispOutput(JSON.stringify(
                                tmpl.getCombinedParameters(editor.getValue()),
                                null,
                                2
                            ));
                        };
                        document.getElementById('view-render-btn').onclick = () => {
                            const rendered = tmpl.render(editor.getValue());
                            const msg = [
                                'WARNING: The below declaration is only for inspection and debug purposes. Submitting the ',
                                'below ouput to AS3 directly can result in loss of tenants\nand applications. Please only ',
                                'submit this declaration through FAST.\n\n',
                                rendered
                            ].join('');
                            this.$root.dispOutput(msg);
                        };
                    }
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
                                previousDef: existingApp
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
                    const versionError = e.message.match(/^.*since it requires AS3.*$/m);
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
</style>
