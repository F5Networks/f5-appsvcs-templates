<template>
    <div class="sorted-table">
        <input
            v-model="filter"
            type="search"
            placeholder="Filter rows..."
        >
        <table>
            <thead>
                <tr>
                    <th
                        v-if="checkboxes"
                        class="checkbox-col"
                    >
                        <input
                            v-model="selAll"
                            type="checkbox"
                        >
                    </th>
                    <th
                        v-for="column in columnNames"
                        :key="column"
                        @click="sort(column)"
                    >
                        <span class="fas fa-sort" />
                        {{ column }}
                    </th>
                </tr>
            </thead>
            <tr
                v-for="row in sortedRows"
                :key="getRowKey(row)"
            >
                <td
                    v-if="checkboxes"
                    class="checkbox-col"
                >
                    <input
                        v-model="selectedRows"
                        :value="row"
                        type="checkbox"
                    >
                </td>
                <td
                    v-for="prop in filteredColumns"
                    :key="prop.property || prop"
                >
                    <span v-if="typeof(prop) === 'object'">
                        <a
                            v-if="prop.doNotRoute"
                            :href="createLink(prop, row)"
                        >
                            {{ row[prop.property] }}
                        </a>
                        <router-link
                            v-else
                            :to="createLink(prop, row)"
                        >
                            {{ row[prop.property] }}
                        </router-link>
                    </span>
                    <span v-else>{{ row[prop] }}</span>
                </td>
            </tr>
        </table>
    </div>
</template>

<script>
// eslint-disable-next-line import/no-extraneous-dependencies
const Mustache = require('mustache');

export default {
    name: 'SortedTable',
    props: {
        tableData: {
            type: Array,
            required: true
        },
        columns: {
            type: Object,
            required: true
        },
        checkboxes: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            currentKey: '',
            currentDir: 'asc',
            selectedRows: [],
            selAll: false,
            filter: ''
        };
    },
    computed: {
        filteredColumns() {
            return Object.keys(this.columns).reduce((acc, key) => {
                const value = this.columns[key];
                if (!value.hidden) {
                    acc[key] = value;
                }
                return acc;
            }, {});
        },
        filteredRows() {
            const allRows = this.tableData;
            if (this.filter) {
                const matchedRows = [];
                allRows.forEach((row) => {
                    let matched = false;
                    Object.values(this.columns).forEach((c) => {
                        if (!matched) {
                            const key = c.property || c;
                            const val = row[key].toString();
                            matched = val.toLowerCase().includes(this.filter);
                            if (!matched) {
                                try {
                                    const filterRegex = new RegExp(this.filter, 'i');
                                    matched = filterRegex.test(val);
                                } catch {
                                    // don't error if not valid regex
                                }
                            }
                            if (matched) {
                                matchedRows.push(row);
                            }
                        }
                    });
                });
                return matchedRows;
            }
            return allRows;
        },
        columnNames() {
            return Object.keys(this.filteredColumns);
        },
        sortedRows() {
            return this.filteredRows.slice().sort((a, b) => {
                const dir = (this.currentDir === 'asc') ? 1 : -1;
                const column = this.columns[this.currentKey];
                const prop = column.property || column;
                if (a[prop] < b[prop]) return -1 * dir;
                if (a[prop] > b[prop]) return 1 * dir;
                return 0;
            });
        }
    },
    watch: {
        selAll(val) {
            if (val) {
                this.selectedRows = this.sortedRows;
            } else {
                this.selectedRows = [];
            }
        }
    },
    created() {
        this.currentKey = this.columnNames[0];
    },
    methods: {
        sort(key) {
            if (key === this.currentKey) {
                // Clicked again, switch direction
                this.currentDir = (this.currentDir === 'asc') ? 'dsc' : 'asc';
            }

            this.currentKey = key;
        },
        createLink(prop, row) {
            return Mustache.render(prop.link, { row });
        },
        getRowKey(row) {
            const keys = Object.values(this.columns)
                .map(x => x.property || x);
            return keys.reduce((acc, cur) => acc + row[cur], '');
        }
    }
};
</script>

<style scoped>
table {
    width: 100%;
    border: 2px solid #b6b6b4;
    border-collapse: collapse;
    margin: 0.5em;
}

.checkbox-col {
    cursor: initial;
    width: 2em;
    padding: 0.3em;
}

th {
    text-align: left;
    background-image: linear-gradient(#d3d2cf, #bab9b4);
    border-left: 2px solid #b6b6b4;
    padding: 0.3em;
    cursor: pointer;
}

tr {
    background-color: #ffffff;
    border-bottom: 2px solid #b6b6b4;
}

td {
    padding: 0.3em 0.3em 0.3em 1.3em;
}

a {
    color: #428bca;
    text-decoration: none;
}

a:hover {
    text-decoration: underline;
}

a:visited {
    color: #428bca;
}
</style>
