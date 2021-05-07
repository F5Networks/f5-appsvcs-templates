<template>
    <div
        class="modal modal-sm"
        :class="{ 'active': visible }"
    >
        <div class="modal-container">
            <div class="modal-header">
                <div class="modal-title">
                    {{ title }}
                </div>
            </div>
            <div class="modal-body">
                <div class="fas fa-info-circle modal-icon" />
                <span class="modal-message">{{ message }}</span>
            </div>
            <div class="modal-footer">
                <button
                    class="btn"
                    @click="confirm"
                >
                    {{ confirmText }}
                </button>
                <button
                    class="btn"
                    @click="cancel"
                >
                    {{ cancelText }}
                </button>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'ModalDialog',
    props: {
        title: {
            type: String,
            required: true
        },
        confirmText: {
            type: String,
            default: 'Confirm'
        },
        cancelText: {
            type: String,
            default: 'Cancel'
        }
    },
    data() {
        return {
            visible: false,
            message: '',
            confirmFunc: () => {}
        };
    },
    methods: {
        show(msg, confirmFunc) {
            this.message = msg;
            this.confirmFunc = confirmFunc;
            this.visible = true;
        },
        confirm() {
            const func = this.confirmFunc || Promise.resolve();
            return Promise.resolve()
                .then(() => func())
                .then(() => this.cancel());
        },
        cancel() {
            this.visible = false;
        }
    }
};
</script>

<style scoped>
.modal-container {
    background-color: #f7f6f5;
    padding: 0 !important;
    border: 1px solid black;
}

.modal-header {
    background-color: #728192;
    color: white;
    font-weight: bold;
    font-size: 110%;
}

.modal-footer {
    background-image: linear-gradient(#dbdbd8, #c5c5c5);
    border-top: 2px solid #5d5c5c;
    padding: 0.5em;
}

.modal-icon {
    font-size: 300%;
    float: left;
    margin-right: 0.5em;
}

.modal-message {
    vertical-align: middle;
    white-space: pre-line;
}
</style>
