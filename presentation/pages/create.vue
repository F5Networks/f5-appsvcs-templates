<template>
    <div id="page-create">
        <p v-if="data.sets" class="text-bold">Available Templates: </p>
        <div id="tmpl-btns">
            <div v-for="set in data.sets"
                class="clickable"
                @click="currentSet(set.name)"
                >
                <div v-if="set.expanded">
                    <span class="fas icon fa-angle-down"></span>
                    <div class="divider text-centered divider-after" :data-content="set.name"></div>
                    <div class="expandable-holder">
                        <button v-for="template in set.templates"
                                class="btn btn-template"
                                @click.stop="newEditor(template.name)"
                                >
                            {{template.name}}
                        </button>
                    </div>
                </div>
                <div v-else>
                    <span class="fas icon fa-angle-right"></span>
                    <span class="text-bold">{{set.name}}</span>
                </div>
            </div>
        </div>
        <div>
            <div id="form-div"></div>
            <div class="text-right">
                <button type="button" class="btn" id="view-tmpl-btn" disabled>View Template</button>
                <button type="button" class="btn" id="view-schema-btn" disabled>View Schema</button>
                <button type="button" class="btn" id="view-view-btn" disabled>View Inputs</button>
                <button type="button" class="btn" id="view-render-btn" disabled>View Rendered</button>
                <button type="button" class="btn" id="btn-form-submit" disabled>SUBMIT</button>
            </div>
        </div>
    </div>
</template>

<script>
module.exports = {
    name: 'page-create',
    props: ['data']
};
</script>
