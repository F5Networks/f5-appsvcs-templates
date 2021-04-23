<template>
    <div id="page-applications">
        <div
            id="app-list"
            class="styled-list"
        >
            <div class="th-row">
                <div class="td tenant-app-th col1">
                    <span class="tenant-app-th tenant">Tenant</span>
                    <span class="fas fa-angle-double-right icon tenant-app-th" />
                    <span class="tenant-app-th application">Application</span>
                </div>
                <div class="td col2">
                    Template
                </div>
                <div class="td col3">
                    Actions
                </div>
            </div>
            <div
                class="tr"
                height="1px"
            />
            <div
                v-for="app in appsList"
                :key="app.tenant + app.name"
                class="tr"
            >
                <div
                    class="td col1 clickable"
                    @click="$root.$router.push('/modify/'+app.path)"
                >
                    <span class="tenant">{{ app.tenant }}</span>
                    <span class="fas fa-angle-double-right icon" />
                    <span class="application">{{ app.name }}</span>
                </div>
                <div class="td col2">
                    {{ app.template }}
                </div>
                <div class="td col3">
                    <span
                        class="tooltip tooltip-right"
                        data-tooltip="Modify Application"
                    >
                        <router-link
                            class="fas fa-edit icon btn-icon"
                            :to="'/modify/'+app.path"
                        />
                    </span>
                    <span
                        class="tooltip tooltip-right"
                        data-tooltip="Delete Application"
                    >
                        <a
                            class="fas fa-trash icon btn-icon"
                            @click="deleteApplication(app.path)"
                        />
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'PageApplications',
    data() {
        return {
            appsList: []
        };
    },
    async created() {
        await this.$root.getJSON('applications')
            .then((appsList) => {
                appsList.forEach((app) => {
                    app.path = `${app.tenant}/${app.name}`;
                });
                this.appsList = appsList;
                this.$root.dispOutput('');
            })
            .catch(e => this.$root.dispOutput(`Error fetching applications: ${e.message}`));
    },
    methods: {
        deleteApplication(appPath) {
            this.$root.showModal(
                'warning',
                `Application ${appPath} will be permanently deleted!`,
                () => {
                    this.$root.busy = true;
                    this.$root.dispOutput(`Deleting ${appPath}`);
                    return Promise.resolve()
                        .then(() => this.$root.safeFetch(`${this.$root.endPointUrl}/applications/${appPath}`, {
                            method: 'DELETE'
                        }))
                        .then(() => {
                            this.$root.$router.push('tasks');
                        })
                        .catch(e => this.$root.dispOutput(`Failed to delete ${appPath}:\n${e.message}`));
                }
            );
        }
    }
};
</script>
