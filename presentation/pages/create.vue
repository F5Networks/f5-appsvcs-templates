<template>
    <div id="page-create">
        <div id="form-header">
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
        <div id="form-div" />
        <div class="text-right">
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
export default {
    name: 'PageCreate',
    beforeRouteLeave(to, from, next) {
        this.$root.forceNav();
        next();
    },
    data() {
        return {
            backTo: ''
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
                .then(() => this.$root.newEditor(template, parameters, existingApp))
                .catch(e => this.$root.dispOutput(e.message));
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
  text-align: right;
  padding: 0.5em;
}
</style>
