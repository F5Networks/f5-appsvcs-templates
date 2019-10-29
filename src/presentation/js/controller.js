/*
 * Copyright 2019. F5 Networks, Inc. See End User License Agreement ("EULA") for
 * license terms. Notwithstanding anything to the contrary in the EULA, Licensee
 * may copy and modify this software product for its internal business purposes.
 * Further, Licensee may upload, publish and distribute the modified version of
 * the software product on devcentral.f5.com.
 */


// eslint-disable-next-line
angular.module('main', [])
    .controller('main', function($scope, $http) {

        $scope.showForm = function(formName) {
            // defining $scope.selectedForm hides the app list view
            // and unhides the app update view
            // eslint-disable-next-line
            $scope.appItems = angular.copy($scope.formDefs[formName]);
            $scope.selectedForm = formName;
            $scope.selectedApp = undefined;
            $scope.selectedTenant = undefined;
        };

        $scope.showApp = function(tenantName, appName) {
            // defining $scope.selectedApp hides the app list view
            // and unhides the app update view
            // eslint-disable-next-line
            $scope.appItems = angular.copy($scope.appDefs[tenantName][appName].items);
            $scope.selectedForm = $scope.appDefs[tenantName][appName].template;
            $scope.selectedApp = appName;
            $scope.selectedTenant = tenantName;
        };

        $scope.clearApp = function() {
            $scope.selectedForm = undefined;
            $scope.selectedApp = undefined;
            $scope.selectedTenant = undefined;
            $scope.updatePending = false;
            $scope.updateError = false;
            $scope.updateErrorMsg = '';
        };

        const arrToObj = function(arr) {
            let obj = {};
            arr.forEach(item => {
                if (item.name) {
                    if (typeof item.value === 'object') {
                        // data from array inside array item
                        obj[item.name] = JSON.stringify(item.value);
                    } else {
                        // data from integers, strings, enums
                        obj[item.name] = item.value;
                    }
                }
            });
            return obj;
        };

        const contentTypeHeader = {
            headers: { 'Content-Type': 'application/json' }
        };

        const mustacheRender = function(formName, appData) {
            return $http.post(`/mgmt/shared/mystique/form/${formName}`, appData, contentTypeHeader)
                .then((res) => {
                    console.log(`mustache response (${typeof res.data}): ${JSON.stringify(res.data)}`);
                    // TODO: handle errors by HTTP return code
                    if (res.status !== 200 || typeof res.data !== 'object') {
                        throw res.data;
                    }
                    return res.data;
                });
        };

        const as3Patch = function(formDecl, appData) {
            var tenantNames = [];
            var appNames = [];
            var patchBody = [];
            var decl = {};

            if (formDecl.class === 'AS3') {
                // eslint-disable-next-line
                decl = angular.copy(formDecl.declaration);
            } else {
                // eslint-disable-next-line
                decl = angular.copy(formDecl);
            }
            tenantNames = Object.keys(decl).filter(x => decl[x].class === 'Tenant');
            tenantNames.forEach(t => {
                appNames = Object.keys(decl[t]).filter(x => decl[t][x].class === 'Application');
                appNames.forEach(a => {
                    console.log(`initial app def: ${JSON.stringify(decl[t][a])}`);
                    decl[t][a].constants = decl[t][a].constants || {};
                    decl[t][a].constants.class = 'Constants';
                    // eslint-disable-next-line
                    angular.extend(decl[t][a].constants, appData);
                    patchBody.push({
                        op: 'add',
                        path: `/${t}/${a}`,
                        value: decl[t][a]
                    });
                });
            });
            console.log(`sent to AS3: ${JSON.stringify(patchBody)}`);
            return $http({ method: 'PATCH', url: '/mgmt/shared/appsvcs/declare', data: patchBody });
        };

        $scope.updateApp = function(formName, appItems) {
            const appData = arrToObj(appItems);
            appData.template = formName;
            // TODO: rename these for what they are: message flags
            $scope.updatePending = true;
            $scope.updateError = false;
            mustacheRender(formName, appData)
                .then(decl => {
                    return as3Patch(decl, appData);
                })
                .then((res) => {
                    console.log(`reponse from AS3: ${JSON.stringify(res)}`);
                    return $scope.refresh();
                })
                .then(() => {
                    $scope.clearApp();
                })
                .catch((err) => {
                    console.log(`update error: ${JSON.stringify(err)}`);
                    $scope.updatePending = false;
                    $scope.updateError = true;
                    $scope.updateErrorMsg = JSON.stringify(err);
                });
        };

        $scope.refresh = function() {
            return $http.get('/mgmt/shared/mystique/forms')
                .then((res) => {
                    $scope.formNames = Object.keys(res.data);
                    $scope.formDefs = res.data;
                    return $http.get('/mgmt/shared/appsvcs/declare');
                })
                .then((res) => {
                    let decl = res.data;
                    $scope.appDefs = {};
                    $scope.appNames = {};
                    $scope.tenantNames = Object.keys(decl)
                        .filter(t => decl[t].class === 'Tenant');
                    $scope.tenantNames.forEach(t => {
                        $scope.appNames[t] = Object.keys(decl[t])
                            .filter(a => decl[t][a].class == 'Application'
                                && decl[t][a].constants !== undefined
                                && decl[t][a].constants.template !== undefined);
                        if (Object.keys($scope.appNames[t]).length > 0) {
                            $scope.appDefs[t] = {};
                            $scope.appNames[t].forEach(a => {
                                const formName = decl[t][a].constants.template;
                                if ($scope.formDefs[formName] !== undefined) {
                                    // copy template with defaults, then overwrite app values
                                    $scope.appDefs[t][a] = {
                                        template: formName,
                                        description: $scope.formDefs[formName][0].value
                                    };
                                    // eslint-disable-next-line
                                    $scope.appDefs[t][a].items = angular.copy($scope.formDefs[formName]);
                                    $scope.appDefs[t][a].items.forEach((item, index) => {
                                        let c = decl[t][a].constants[item.name];
                                        if (c !== undefined) {
                                            try {
                                                $scope.appDefs[t][a].items[index].value = JSON.parse(c);
                                            } catch (err) {
                                                $scope.appDefs[t][a].items[index].value = c;
                                            }
                                        }
                                    });
                                }
                            });
                        }
                    });
                    $scope.tenantNamesWithApps = Object.keys($scope.appDefs);
                    Promise.resolve();
                });
        };
        $scope.refresh();
    });
