<template>
    <iframe src="apidoc.html" />
</template>

<script>
export default {
    name: 'PageApi',
    created() {
        this.$root.busy = false;
    }
};
</script>

<style scoped>
iframe {
  width: 100%;
  height: 700px;
}
</style>
