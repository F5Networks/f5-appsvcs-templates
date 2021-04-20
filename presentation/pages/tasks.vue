<template>
    <div id="task-list" class="styled-list">
        <div class="th-row">
            <div class="td col1">Task ID</div>
            <div class="td tenant-app-th col2">
                <span class="tenant-app-th tenant">Tenant</span>
                <a class="fas fa-angle-double-right icon tenant-app-th"></a>
                <span class="tenant-app-th application">Application</span>
            </div>
            <div class="td col3">Operation</div>
            <div class="td col4">Result</div></div>
        <div class="tr" height="1px"></div>
        <div v-for="task in data.tasks" class="tr">
            <span class="tooltip tooltip-right td clickable-darker col1" data-tooltip="go to task">
                <a :href="'/mgmt/shared/fast/tasks/' + task.id">{{task.id}}</a>
            </span>
            <div class="td col2">
                <span class="tenant">{{task.tenant}}</span>
                <a class="fas fa-angle-double-right icon"></a>
                <span class="application">{{task.application}}</span>
            </div>
            <div class="td col3">{{task.operation}}</div>
            <div v-if="task.message === 'in progress'" class="td col4">
                <div class='loading loading-sm p-centered'></div>
            </div>
            <div v-else
                 v-bind:class="{ 'success-color': task.message === 'success', 'danger-color': task.errMsg }"
                 class="td col4"
                 >
                {{task.message}}
                <div v-if="task.errMsg" class="popover popover-left">
                    <a class="cursor-default danger-color fas fa-question-circle icon"></a>
                    <div class="popover-container">
                        <div class='popover-header' style="background-color: #2b1111e6;">
                            {{task.message}}
                        </div>
                        <div class='popover-arrow-right arrow-danger'></div>
                        <div class='popover-body' style="background-color: #442222f0;">
                            {{task.errMsg}}
                        </div>
                    </div>
                </div>
                <span v-if="task.canResubmit" class="tooltip tooltip-right" data-tooltip="Modify and Resubmit Application">
                    <a class="fas fa-edit btn-icon" :href="'#resubmit/'+task.id"></a>
                </span>
            </div>
        </div>
    </div>
</template>

<script>
module.exports = {
    name: 'page-tasks',
    props: ['data']
};
</script>
