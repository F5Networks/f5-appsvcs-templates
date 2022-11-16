<template>
    <div
        id="form-div"
        ref="form"
    />
</template>

<script>
// eslint-disable-next-line import/no-extraneous-dependencies
const { JSONEditor } = require('@json-editor/json-editor');
// eslint-disable-next-line import/no-extraneous-dependencies
const { marked } = require('marked');
const { guiUtils } = require('@f5devcentral/f5-fast-core');

// eslint-disable-next-line no-undef
class Base64Editor extends JSONEditor.defaults.editors.string {
    setValue(val) {
        if (val) {
            val = Buffer.from(val, 'base64').toString('utf8');
        }
        super.setValue(val);
    }

    getValue() {
        let retval = super.getValue();
        if (retval) {
            retval = Buffer.from(retval).toString('base64');
        }
        return retval;
    }
}

// eslint-disable-next-line no-undef
JSONEditor.defaults.editors.base64 = Base64Editor;

// eslint-disable-next-line no-undef
JSONEditor.defaults.resolvers.unshift((schema) => {
    if (schema.type === 'string' && schema.contentEncoding === 'base64') {
        return 'base64';
    }

    return undefined;
});

class InfoEditor extends JSONEditor.defaults.editors.info {
    build() {
        // Modify build to use getFormInputDescription() so we get descriptions
        // with the je-desc class. This allows our Markdown rendering to work with
        // the info editor
        this.options.compact = false;
        // eslint-disable-next-line no-multi-assign
        this.header = this.label = this.theme.getFormInputLabel(this.getTitle());
        this.description = this.theme.getFormInputDescription(this.schema.description || '');
        this.control = this.theme.getFormControl(this.label, this.description, null);
        this.container.appendChild(this.control);
    }
}
JSONEditor.defaults.editors.info = InfoEditor;

export default {
    name: 'CommonEditor',
    data() {
        return {
            editor: null
        };
    },
    methods: {
        init(schema, defaults) {
            if (this.editor) {
                this.editor.destroy();
            }

            const formElement = this.$refs.form;
            this.editor = new JSONEditor(formElement, {
                schema,
                startval: guiUtils.filterExtraProperties(defaults, schema),
                compact: true,
                show_errors: 'always',
                show_opt_in: true,
                disable_edit_json: true,
                disable_properties: true,
                disable_collapse: true,
                keep_oneof_values: false,
                theme: 'spectre'
            });

            this.editor.on('ready', () => {
                // Auto-activate "opt ins" from show_opt_in
                Object.values(this.editor.editors || {})
                    .filter(ed => !ed.isActive())
                    .forEach(ed => ed.activate());

                // Render Markdown in descriptions
                const descElements = formElement.getElementsByClassName('je-desc');
                Array.prototype.map.call(descElements, (elem) => {
                    // Get raw schema description since the element text has newlines stripped
                    const schemaPath = elem.parentElement.parentElement.getAttribute('data-schemapath');
                    const propEd = this.editor.getEditor(schemaPath);
                    const md = propEd.schema.description || '';

                    let html = marked(md);
                    if (html.startsWith('<p>')) {
                        html = html.substring(3, html.length);
                    }
                    if (html.endsWith('</p>')) {
                        html = html.substring(0, html.length - 5);
                    }

                    html = html.replaceAll('<a href', '<a target="_blank" href');
                    elem.innerHTML = html;
                });
            });
        }
    }
};
</script>

<style>
/* JSON Editor Tweaks */
.form-checkbox, .form-radio, .form-switch {
  font-weight: 600;
}

#form-div h4 {
  font-size: revert;
  font-weight: 600;
  display: block;
  line-height: 1.2rem;
  padding: .3rem 0;
}

.form-select, .form-input {
  line-height: initial;
  font-size: inherit;
  height: initial;
  padding: 2px 5px 1px 5px;
}

/* Hide required asterisks */
.required::after {
  content: "" !important;
}

/* Hide first title (we handle this ourselves) */
#form-div > .je-object__container > .je-object__title {
  display: none !important;
}

/* Fixes for Markdown in descriptions */
.je-desc a {
  text-decoration: revert;
  color: revert;
}

/* Hide opt-in checkboxes */
.json-editor-opt-in {
  display: none;
}
</style>
