<template>
    <div id="page-create">
        <div id="form-div" />
        <div class="text-right">
            <button
                id="view-tmpl-btn"
                type="button"
                class="btn"
                disabled
            >
                View Template
            </button>
            <button
                id="view-schema-btn"
                type="button"
                class="btn"
                disabled
            >
                View Schema
            </button>
            <button
                id="view-view-btn"
                type="button"
                class="btn"
                disabled
            >
                View Inputs
            </button>
            <button
                id="view-render-btn"
                type="button"
                class="btn"
                disabled
            >
                View Rendered
            </button>
            <button
                id="btn-form-submit"
                type="button"
                class="btn"
                disabled
            >
                SUBMIT
            </button>
        </div>
    </div>
</template>

<script>
export default {
    name: 'PageCreate',
    watch: {
        $route(to) {
            this.update(to.params);
        }
    },
    async created() {
        await this.update(this.$route.params);
    },
    methods: {
        newEditor(tmplid) {
            this.$root.newEditor(tmplid);
        },
        currentSet(setName) {
            this.sets.forEach((set) => {
                set.expanded = set.name === setName;
            });
        },
        update(params) {
            this.sets = [];
            this.$root.destroyEditor();

            let promiseChain = Promise.resolve();
            let template;
            let parameters;
            let existingApp = false;

            if (params.appid) {
                // Modify
                const appid = params.appid;
                existingApp = true;
                promiseChain = promiseChain
                    .then(() => this.$root.dispOutput(`Fetching app data for ${appid}`))
                    .then(() => this.$root.getJSON(`applications/${appid}`))
                    .then((appData) => {
                        const appDef = appData.constants.fast;
                        template = appDef.template;
                        parameters = appDef.view;
                    });
            } else if (params.taskid) {
                // Resubmit
                const taskid = params.taskid;
                const submissionData = this.$root.getSubmissionData();
                if (!submissionData[taskid]) {
                    this.$root.dispOutput(`Could not find submission data for task ${taskid}`);
                    return Promise.resolve();
                }

                template = submissionData[taskid].template;
                parameters = submissionData[taskid].parameters;
            } else {
                // Create
                template = params.tmplid;
            }

            return promiseChain
                .then(() => this.$root.newEditor(template, parameters, existingApp))
                .catch(e => this.$root.dispOutput(e.message));
        }
    }
};
</script>
