<template>
    <sorted-table
        ref="table"
        :table-data="tasks"
        :columns="columns"
    />
</template>

<script>
import SortedTable from '../components/SortedTable.vue';

export default {
    name: 'PageTasks',
    components: {
        SortedTable
    },
    data() {
        return {
            tasks: [],
            columns: {
                Application: 'application',
                Template: 'name',
                Operation: 'operation',
                Status: 'status',
                'App Template': {
                    property: 'edit',
                    link: '/resubmit/{{row.id}}'
                },
                Timestamp: 'timestamp',
                Info: 'message'
                // uncomment for debug
                // eslint-disable-next-line comma-style
                // , 'Task ID': {
                //     property: 'id',
                //     link: '/mgmt/shared/fast/tasks/{{row.id}}',
                //     doNotRoute: true
                // }
            }
        };
    },
    async created() {
        const submissionData = this.$root.getSubmissionData();
        const updateTaskList = () => this.$root.getJSON('tasks')
            .then((tasks) => {
                tasks.forEach((task) => {
                    if (task.message.includes('Error:')) {
                        task.message = task.message.replace(/Error:/);
                        task.status = 'Error';
                    } else if (task.message.includes('declaration failed')) {
                        task.message = task.message.replace(/declaration failed/);
                        task.status = 'Declaration Failed';
                    } else if (task.message.includes('declaration is invalid')) {
                        task.message = task.message.replace(/declaration is invalid/);
                        task.status = 'Declaration is Invalid';
                    } else if (task.message === 'success') {
                        task.status = 'Success';
                        task.message = '';
                    } else if (task.message === 'no change') {
                        task.status = 'No Change';
                        task.message = '';
                    } else if (task.message === 'in progress') {
                        task.status = 'In Progress';
                        task.message = '';
                    } else {
                        task.status = 'N/A';
                    }

                    task.edit = (submissionData[task.id]) ? 'Edit / Resubmit' : '';

                    if (task.operation === 'delete-all') {
                        task.operation = 'Delete All';
                    } else {
                        task.operation = task.operation.charAt(0).toUpperCase() + task.operation.slice(1);
                    }

                    task.application = (task.application === '') ? 'N/A' : task.application;
                    task.name = (task.name === '') ? 'N/A' : task.name;
                });
                this.tasks = tasks;

                const inProgressJob = (
                    tasks.filter(x => x.status === 'In Progress').length !== 0
                );
                if (inProgressJob) {
                    setTimeout(updateTaskList, 2500);
                }
            });

        await updateTaskList()
            .then(() => {
                this.$root.busy = false;
            });
    },
    mounted() {
        this.$refs.table.currentKey = 'Timestamp';
        this.$refs.table.currentDir = 'desc';
    }
};
</script>
