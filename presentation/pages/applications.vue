<template>
    <div id="page-applications">
        <div id="app-list" class="styled-list">
            <div class="th-row">
                <div class="td tenant-app-th col1">
                    <span class="tenant-app-th tenant">Tenant</span>
                    <span class="fas fa-angle-double-right icon tenant-app-th"></span>
                    <span class="tenant-app-th application">Application</span>
                </div>
                <div class="td col2">Template</div>
                <div class="td col3">Actions</div>
            </div>
            <div class="tr" height="1px"></div>
            <div class="tr" v-for="app in data.appsList">
                <div class="td col1 clickable" @click="location.href='#modify/'+app.path">
                    <span class="tenant">{{app.tenant}}</span>
                    <span class="fas fa-angle-double-right icon"></span>
                    <span class="application">{{app.name}}</span>
                </div>
                <div class="td col2">{{app.template}}</div>
                <div class="td col3">
                    <span class="tooltip tooltip-right" data-tooltip="Modify Application">
                        <a class="fas fa-edit icon btn-icon" :href="'#modify/'+app.path"></a>
                    </span>
                    <span class="tooltip tooltip-right" data-tooltip="Delete Application">
                        <a class="fas fa-trash icon btn-icon" @click="deleteApplication(app.path)"></a>
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
module.exports = {
    name: 'page-applications',
    props: ['data']
};
</script>
