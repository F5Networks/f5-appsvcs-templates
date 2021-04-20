<template>
    <div id="page-templates">
        <div v-if="data.errors && data.errors.length > 0" class="text-error">
            <h3>Template errors were found:</h3>
            <ul>
                <li v-for="error in data.errors">
                    {{error}}
                </li>
            </ul>
        </div>
        <div class="button-row-deploy">
            <button type="button" id="btn-delete-all-ts" class="btn btn-red">Delete All</button>
            <button type="button" id="btn-add-ts" class="btn btn-green">Add Template Set</button>
            <input type="file" id="input-ts-file" style="display:none" accept=".zip">
            <div id="templates-filter" class="dropdown dropdown-left">
                <a class="btn btn-primary dropdown-toggle inline-flex" tabindex="0">
                    <p id="filterTag">Filter:</p>
                    <p id="filter">{{data.filters ? data.filters[data.currentFilter] : ''}}</p>
                    <i class="fas fa-angle-down white"></i>
                </a>
                <ul class="menu text-left">
                    <li v-for="(text, id) in data.filters"
                        v-bind:class="{ selected: data.currentFilter === id }"
                        class="menu-item clickable">
                        <a @click="setFilter(id)">{{text}}</a>
                    </li>
                </ul>
            </div>
        </div>
        <div id="template-list">
            <div class="th-row">
                <div class="td col1">TEMPLATES</div>
                <div class="td col2">APPLICATIONS</div>
                <div class="td col3">ACTIONS</div>
            </div>
            <div class="tr" height="1px"></div>
            <div v-for="(setData, setName) in data.sets"
                 v-bind:class="{ 'row-dark-red': !setData.enabled, 'red-hover': !setData.enabled }"
                 class="tr row-dark clickable"
                 @click="setData.expanded = !setData.expanded"
                 >
                <div class="td td-template-set col1">
                    <span class="fas icon"
                          :class="{ 'fa-angle-right': !setData.expanded, 'fa-angle-down': setData.expanded }">
                    </span>
                    {{setName}}&nbsp;
                    <span class="traits">
                        <span v-if="setData.supported"
                              class="tooltip tooltip-right tooltipped-f5-icon"
                              data-tooltip="Template Set Supported by F5"
                              >
                            <svg class="f5-icon"></svg>
                        </span>
                        <span v-if="setData.enabled"
                              class="tooltip tooltip-right"
                              data-tooltip="Template Set is Enabled"
                              >
                            <a class="fas fa-check-circle icon"></a>
                        </span>
                        <span v-else
                              class="tooltip tooltip-right tooltip-red red-base-forecolor"
                              data-tooltip="Template Set is Disabled!"
                              >
                            <a class="fas fa-times-circle icon"></a>
                        </span>

                    </span>
                </div>
                <div class="td col2">
                    <div v-if="setData.expanded">
                        <div v-for="app in setData.apps">
                            {{app.tenant}}
                            <a class="fas fa-angle-double-right icon"></a>
                            {{app.name}}
                        </div>
                    </div>
                    <div v-else-if="setData.apps && setData.apps.length > 0">
                        * click to view *
                    </div>
                </div>
                <div class="td col3">
                    <span v-if="setData.enabled"
                          class="tooltip tooltip-right"
                          data-tooltip="Remove Template Set"
                          >
                        <a @click.stop="removeSet(setName)" class="fas fa-trash icon btn-icon"></a>
                    </span>
                    <span v-else
                          class="tooltip tooltip-right"
                          data-tooltip="Install Template Set"
                          >
                        <a @click.stop="installSet(setName)" class="fas fa-download icon btn-icon"></a>
                    </span>
                    <span v-if="setData.updateAvailable"
                          class="tooltip tooltip-right"
                          data-tooltip="Update Template Set"
                          >
                        <a @click.stop="updateSet(setName)" class="fas fa-edit icon btn-icon"></a>
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
module.exports = {
    name: 'page-templates',
    props: ['data']
};
</script>
