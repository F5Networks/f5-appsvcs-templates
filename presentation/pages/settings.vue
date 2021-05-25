<template>
    <div id="page-settings">
        <editor ref="editor" />
        <button
            type="button"
            class="btn btn-primary"
            :disabled="disableSubmit"
            @click="saveSettings"
        >
            Save
        </button>
    </div>
</template>

<script>
import Editor from '../components/Editor.vue';

export default {
    name: 'PageSettings',
    components: {
        Editor
    },
    data() {
        return {
            disableSubmit: true
        };
    },
    created() {
        this.$root.busy = false;
    },
    async mounted() {
        const editor = this.$refs.editor;
        await Promise.resolve()
            .then(() => Promise.all([
                this.$root.getJSON('settings-schema'),
                this.$root.getJSON('settings')
            ]))
            .then(([schema, defaults]) => {
                editor.init(schema, defaults);

                const ed = editor.editor;
                ed.on('ready', () => {
                    this.disableSubmit = false;
                });
                ed.on('change', () => {
                    this.disableSubmit = ed.validation_results.length !== 0;
                });
            })
            .catch(e => this.$root.dispOutput(`Error loading settings: ${e.message}`));
    },
    methods: {
        saveSettings() {
            const ed = this.$refs.editor.editor;
            const config = ed.getValue();

            this.$root.busy = true;
            this.$root.dispOutput('Saving settings...');

            return Promise.resolve()
                .then(() => this.$root.safeFetch(`${this.$root.endPointUrl}/settings`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(config)
                }))
                .then(() => this.$root.dispOutput('Settings saved successfully'))
                .catch(e => this.$root.dispOutput(`Failed to save settings: ${e.message}`))
                .finally(() => {
                    this.$root.busy = false;
                });
        }
    }
};
</script>
