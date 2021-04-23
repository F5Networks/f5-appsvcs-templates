<template>
    <div id="page-create">
        <p v-if="sets.length > 0" class="text-bold">Available Templates: </p>
        <div id="tmpl-btns">
            <div v-for="set in sets"
                class="clickable"
                @click="currentSet(set.name)"
                >
                <div v-if="set.expanded">
                    <span class="fas icon fa-angle-down"></span>
                    <div class="divider text-centered divider-after" :data-content="set.name"></div>
                    <div class="expandable-holder">
                        <button v-for="template in set.templates"
                                class="btn btn-template"
                                @click.stop="newEditor(template.name)"
                                >
                            {{template.name}}
                        </button>
                    </div>
                </div>
                <div v-else>
                    <span class="fas icon fa-angle-right"></span>
                    <span class="text-bold">{{set.name}}</span>
                </div>
            </div>
        </div>
        <div>
            <div id="form-div"></div>
            <div class="text-right">
                <button type="button" class="btn" id="view-tmpl-btn" disabled>View Template</button>
                <button type="button" class="btn" id="view-schema-btn" disabled>View Schema</button>
                <button type="button" class="btn" id="view-view-btn" disabled>View Inputs</button>
                <button type="button" class="btn" id="view-render-btn" disabled>View Rendered</button>
                <button type="button" class="btn" id="btn-form-submit" disabled>SUBMIT</button>
            </div>
        </div>
    </div>
</template>

<script>
module.exports = {
    name: 'page-create',
    data() {
        return {
            sets: []
        }
    },
    watch: {
        $route(to, from) {
            this.update(to.params);
        }
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

            if (params.appid) {
                // Modify
                const appid = params.appid;
                this.$root.dispOutput(`Fetching app data for ${appid}`);
                promiseChain = promiseChain
                    .then(() => this.$root.getJSON(`applications/${appid}`))
                    .then((appData) => {
                        const appDef = appData.constants.fast;
                        this.$root.newEditor(appDef.template, appDef.view, true);
                    })
                    .catch(e => this.$root.dispOutput(e.message));
            } else if (params.taskid) {
                // Resubmit
                const taskid = params.taskid;
                const submissionData = this.$root.getSubmissionData();
                if (!submissionData[taskid]) {
                    this.$root.dispOutput(`Could not find submission data for task ${taskid}`);
                    return next();
                }

                const template = submissionData[taskid].template;
                const parameters = submissionData[taskid].parameters;

                promiseChain = promiseChain
                    .then(() => this.$root.newEditor(template, parameters))
                    .catch(e => this.$root.dispOutput(e.message));
            } else {
                // Create
                promiseChain = promiseChain
                    .then(() => this.$root.getJSON('templatesets'))
                    .then((data) => {
                        this.sets = data.map(x => Object.assign({}, x, { expanded: false }));
                        this.$root.dispOutput('');
                    })
                    .catch(e => this.$root.dispOutput(e.message));
            }

            return promiseChain;
        }
    },
    async created() {
        await this.update(this.$route.params);
    }
};
</script>
