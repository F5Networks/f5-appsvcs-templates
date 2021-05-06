<template>
    <div id="page-templates">
        <div
            v-if="templateErrors.length > 0"
            class="text-error"
        >
            <h3>Template errors were found:</h3>
            <ul>
                <li
                    v-for="error in data.errors"
                    :key="error"
                >
                    {{ error }}
                </li>
            </ul>
        </div>
        <input
            ref="fileInput"
            type="file"
            style="display:none"
            accept=".zip"
            @change="installSet"
        >
        <button
            class="btn float-right"
            @click="$refs.fileInput.click()"
        >
            Add Template Set
        </button>
        <p>To deploy an application, start by selecting a template below</p>
        <div
            v-for="setData in setsList"
            :key="setData.name"
            class="table-block"
        >
            <div class="clearfix">
                <button
                    class="btn float-right"
                    @click="removeSet(setData.name)"
                >
                    Remove
                </button>
                <span class="text-bold">{{ setData.name }}</span>
            </div>
            <sorted-table
                :table-data="setData.templates"
                :columns="templateColumns"
            />
        </div>
        <modal-dialog
            ref="modal"
            title="Remove"
            confirm-text="Remove"
        />
    </div>
</template>

<script>
import SortedTable from '../components/SortedTable.vue';
import ModalDialog from '../components/ModalDialog.vue';

export default {
    name: 'PageTemplates',
    components: {
        SortedTable,
        ModalDialog
    },
    data() {
        return {
            setsList: [],
            templateErrors: [],
            templateColumns: {
                Name: {
                    property: 'name',
                    link: '/create/{{row.path}}'
                },
                'Apps using template': 'numApps',
                Description: 'description'
            }
        };
    },
    async created() {
        await this.reloadTemplates()
            .then(() => {
                this.$root.busy = false;
            });
    },
    methods: {
        reloadTemplates() {
            this.$root.busy = true;
            return Promise.resolve()
                .then(() => Promise.all([
                    this.$root.getJSON('templatesets'),
                    this.$root.getJSON('templatesets?showDisabled=true')
                ]))
                .then(([setsList, disabledSetsList]) => {
                    setsList.forEach((set) => {
                        set.templates.forEach((tmpl) => {
                            tmpl.path = tmpl.name;
                            tmpl.name = (tmpl.title !== '') ? tmpl.title : tmpl.name.split('/')[1];
                            tmpl.numApps = tmpl.appsList.length;
                        });
                    });
                    this.templateErrors = disabledSetsList.reduce((acc, curr) => {
                        if (curr.error) {
                            acc.push(curr.error);
                        }
                        return acc;
                    }, []);
                    this.setsList = setsList;
                    this.$root.dispOutput('');
                })
                .catch(e => this.$root.dispOutput(`Error fetching templates: ${e.message}`))
                .finally(() => {
                    this.$root.busy = false;
                });
        },
        installSet() {
            const file = this.$refs.fileInput.files[0];
            const tsName = file.name.slice(0, -4);
            this.$root.busy = true;
            this.$root.dispOutput(`Uploading file: ${file.name}`);
            this.$root.multipartUpload(file)
                .then(() => this.$root.dispOutput(`Installing template set ${tsName}`))
                .then(() => this.$root.safeFetch('/mgmt/shared/fast/templatesets', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: file.name.slice(0, -4)
                    })
                }))
                .then(() => {
                    this.$root.dispOutput(`${tsName} installed successfully`);
                })
                .then(() => this.reloadTemplates())
                .catch((e) => {
                    this.$root.dispOutput(`Failed to install ${tsName}:\n${e.message}`);
                })
                .finally(() => {
                    this.$root.busy = false;
                });
        },
        removeSet(setName) {
            this.$refs.modal.show(
                `Are you sure you want to remove application template set "${setName}"?`,
                () => {
                    this.$root.busy = true;
                    this.$root.dispOutput(`Deleting ${setName}`);
                    return Promise.resolve()
                        .then(() => this.$root.safeFetch(`${this.$root.endPointUrl}/templatesets/${setName}`, {
                            method: 'DELETE'
                        }))
                        .then(() => {
                            this.$root.dispOutput(`${setName} deleted successfully`);
                        })
                        .then(() => this.reloadTemplates())
                        .catch((err) => {
                            this.$root.dispOutput(`Failed to delete ${setName}:\n${err.message}`);
                        })
                        .finally(() => {
                            this.$root.busy = false;
                        });
                }
            );
        }
    }
};
</script>

<style scoped>
.table-block {
    margin: 2em 0;
}
.sorted-table {
    margin: 1em 0;
}
</style>
