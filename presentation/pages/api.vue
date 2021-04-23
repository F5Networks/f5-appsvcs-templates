<template>
    <iframe src="apidoc.html" />
</template>

<script>
export default {
    name: 'PageApi',
    props: {
        data: {
            type: Object,
            required: true
        }
    }
};
</script>
