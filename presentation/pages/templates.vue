<template>
    <div id="page-templates">
        <div
            v-if="templateErrors.length > 0"
            class="text-error"
        >
            <h3>Template errors were found:</h3>
            <ul>
                <li
                    v-for="error in templateErrors"
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
            @change="installSetFile"
        >
        <div class="float-right">
            <button @click="installSet">
                Add Template Set From
            </button>
            <select v-model="installType">
                <option>File</option>
                <option>GitHub</option>
                <option>GitLab</option>
            </select>
        </div>
        <p>To deploy an application, start by selecting a template below</p>
        <div
            v-for="setData in setsList"
            :key="setData.name"
            class="table-block"
        >
            <div class="clearfix">
                <button
                    class="float-right"
                    @click="removeSet(setData.name)"
                >
                    Remove
                </button>
                <img
                    v-if="setData.gitHubRepo"
                    class="templatesets-icon"
                    src="img/github_icon.png"
                >
                <img
                    v-else-if="setData.gitLabRepo"
                    class="templatesets-icon"
                    src="img/gitlab_icon.png"
                >
                <img
                    v-else
                    class="templatesets-icon"
                    src="img/file_icon.png"
                >

                <span class="text-bold">{{ setData.name }}</span>
            </div>
            <div
                v-if="setData.gitUpdateAvailable"
                class="clearfix"
            >
                <a
                    class="float-left"
                >
                    Updates Available
                </a>
            </div>
            <sorted-table
                :table-data="setData.templates"
                :columns="templateColumns"
            />
        </div>
        <modal-dialog
            ref="removeModal"
            title="Remove"
            confirm-text="Remove"
        />
        <modal-dialog
            ref="gitModal"
            :title="'Install from ' + installType"
            confirm-text="Install"
            :allow-confirm="gitInstallInfo.repo !== null && gitInstallInfo.repo.includes('/')"
        >
            <template #body>
                <div class="form-group">
                    <label
                        v-if="installType==='GitLab'"
                        class="form-label"
                        for="gitUrl"
                    >
                        URL:
                    </label>
                    <input
                        v-if="installType==='GitLab'"
                        id="gitUrl"
                        v-model="gitInstallInfo.url"
                        class="form-input"
                        placeholder="https://gitlab.com"
                    >

                    <label
                        class="form-label"
                        for="gitRepo"
                    >
                        Repository:
                    </label>
                    <input
                        id="gitRepo"
                        v-model="gitInstallInfo.repo"
                        class="form-input"
                        placeholder="org/project"
                    >

                    <label
                        class="form-label"
                        for="gitToken"
                    >
                        Auth Token:
                    </label>
                    <input
                        id="gitToken"
                        v-model="gitInstallInfo.token"
                        class="form-input"
                    >

                    <label
                        class="form-label"
                        for="unprotected"
                    >
                        Unprotected:
                    </label>
                    <input
                        id="unprotected"
                        v-model="gitInstallInfo.unprotected"
                        type="checkbox"
                    >

                    <label
                        class="form-label"
                        for="gitSubDir"
                    >
                        Repository Sub-directory:
                    </label>
                    <input
                        id="gitSubDir"
                        v-model="gitInstallInfo.subDir"
                        class="form-input"
                    >

                    <label
                        class="form-label"
                        for="gitRef"
                    >
                        Git Ref:
                    </label>
                    <input
                        id="gitRef"
                        v-model="gitInstallInfo.ref"
                        class="form-input"
                        placeholder="main"
                    >

                    <label
                        class="form-label"
                        for="gitName"
                    >
                        Installed Set Name:
                    </label>
                    <input
                        id="gitName"
                        v-model="gitInstallInfo.name"
                        class="form-input"
                        :placeholder="gitInstallSetName"
                    >
                </div>
            </template>
        </modal-dialog>
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
            },
            installType: 'File',
            gitInstallInfo: {
                name: null,
                repo: null,
                url: null,
                token: null,
                subDir: null,
                ref: null,
                unprotected: null
            }
        };
    },
    computed: {
        gitInstallSetName() {
            return (
                this.gitInstallInfo.name
                || this.gitInstallInfo.subDir
                || ((this.gitInstallInfo.repo) ? this.gitInstallInfo.repo.split('/')[1] : '')
            );
        }
    },
    async created() {
        await this.reloadTemplates();
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
        installSetFile() {
            const file = this.$refs.fileInput.files[0];
            const tsName = file.name.slice(0, -4);
            this.$root.busy = true;
            this.$root.dispOutput(`Uploading file: ${file.name}`);
            this.$root.multipartUpload(file)
                .then(() => this.$root.dispOutput(`Installing template set ${tsName}`))
                .then(() => this.$root.safeFetch('/mgmt/shared/fast/templatesets', {
                    method: 'POST',
                    body: {
                        name: file.name.slice(0, -4)
                    }
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
        clearGitInstallInfo() {
            Object.keys(this.gitInstallInfo).forEach((key) => {
                this.gitInstallInfo[key] = null;
            });
        },
        gitInfoToBody(info, opts) {
            return Object.assign(
                {},
                {
                    gitToken: info.token || undefined,
                    gitSubDir: info.subDir || undefined,
                    gitRef: info.ref || undefined,
                    name: info.name || undefined,
                    unprotected: info.unprotected || undefined
                },
                opts
            );
        },
        installSetGitHub() {
            this.$refs.gitModal.show(
                '',
                () => {
                    const info = this.gitInstallInfo;
                    this.$root.busy = true;
                    this.$root.dispOutput(`Installing template set from ${info.repo} on GitHub`);
                    this.$root.safeFetch('/mgmt/shared/fast/templatesets', {
                        method: 'POST',
                        body: this.gitInfoToBody(info, { gitHubRepo: info.repo })
                    })
                        .then(() => {
                            this.$root.dispOutput(`${this.gitInstallSetName} installed successfully`);
                        })
                        .then(() => this.reloadTemplates())
                        .catch((e) => {
                            this.$root.dispOutput(`Failed to install ${this.gitInstallSetName}:\n${e.message}`);
                        })
                        .finally(() => {
                            this.$root.busy = false;
                        });
                }
            );
        },
        installSetGitLab() {
            this.$refs.gitModal.show(
                '',
                () => {
                    const info = this.gitInstallInfo;
                    this.$root.busy = true;
                    this.$root.dispOutput(`Installing template set from ${info.repo} on GitLab instance at ${info.url}`);
                    this.$root.safeFetch('/mgmt/shared/fast/templatesets', {
                        method: 'POST',
                        body: this.gitInfoToBody(
                            info,
                            {
                                gitLabRepo: info.repo,
                                gitLabUrl: info.url || undefined
                            }
                        )
                    })
                        .then(() => {
                            this.$root.dispOutput(`${this.gitInstallSetName} installed successfully`);
                        })
                        .then(() => this.reloadTemplates())
                        .catch((e) => {
                            this.$root.dispOutput(`Failed to install ${this.gitInstallSetName}:\n${e.message}`);
                        })
                        .finally(() => {
                            this.$root.busy = false;
                        });
                }
            );
        },
        installSet() {
            this.clearGitInstallInfo();
            if (this.installType === 'File') {
                this.$refs.fileInput.click();
            } else if (this.installType === 'GitHub') {
                this.installSetGitHub();
            } else if (this.installType === 'GitLab') {
                this.installSetGitLab();
            }
        },
        removeSet(setName) {
            this.$refs.removeModal.show(
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
.templatesets-icon {
    width: 20px;
    height: 20px;
    margin-right: 5px;
    vertical-align: middle
}
</style>
