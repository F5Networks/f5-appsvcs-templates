<template>
    <div id="page-applications">
        <sorted-table
            ref="table"
            :table-data="appsList"
            :columns="columns"
            :checkboxes="true"
        />
        <button
            class="btn btn-primary"
            :disabled="!$refs.table || $refs.table.selectedRows.length === 0"
            @click="deleteApplications()"
        >
            Delete
        </button>
        <modal-dialog
            ref="modal"
            title="Delete"
            confirm-text="Delete"
        />
    </div>
</template>

<script>
import SortedTable from '../components/SortedTable.vue';
import ModalDialog from '../components/ModalDialog.vue';

export default {
    name: 'PageApplications',
    components: {
        SortedTable,
        ModalDialog
    },
    data() {
        return {
            appsList: [],
            columns: {
                Name: {
                    property: 'name',
                    link: '/modify/{{row.path}}'
                },
                Tenant: 'tenant',
                Template: 'template'
            }
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
            .catch(e => this.$root.dispOutput(`Error fetching applications: ${e.message}`))
            .finally(() => {
                this.$root.busy = false;
            });
    },
    methods: {
        deleteApplications() {
            const appPaths = this.$refs.table.selectedRows.map(
                x => `${x.tenant}/${x.name}`
            );
            if (appPaths.length === 0) {
                return;
            }
            this.$refs.modal.show(
                `Are you sure you want to delete the following applications?\n\n${JSON.stringify(appPaths)}`,
                () => {
                    this.$root.busy = true;
                    return Promise.resolve()
                        .then(() => this.$root.safeFetch(`${this.$root.endPointUrl}/applications`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(appPaths)
                        }))
                        .then(() => this.$root.$router.push('tasks'))
                        .catch(e => this.$root.dispOutput(`DELETE failed:\n${e.message}`));
                }
            );
        }
    }
};
</script>
