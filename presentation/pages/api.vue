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

<style scoped>
iframe {
  width: 100%;
  height: 700px;
}
</style>
