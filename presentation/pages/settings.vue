<template>
    <div id="page-settings">
        <div id="form-div" />
        <button
            id="btn-form-submit"
            type="button"
            class="btn btn-primary"
            disabled
        >
            SAVE
        </button>
    </div>
</template>

<script>
export default {
    name: 'PageSettings',
    props: {
        data: {
            type: Object,
            required: true
        }
    }
};
</script>
