#!/usr/bin/env bash

# Script requires the following deployment_info.json setting file
# {
#     "deploymentId": "test",
#     "environment": "vio",
#     "instances": [
#         {
#             "admin_password": "<PASSWORD>",
#             "admin_username": "<USERNAME>",
#             "mgmt_address": "<MGMT_IP>",
#             "mgmt_port": <MGMT_PORT>
#         }
#     ]
# }

PATH_TO_DEPLOYMENT_INFO=${1:-deployment_info.json}
INSTANCES=$(cat $PATH_TO_DEPLOYMENT_INFO | jq .instances -r)

FIRST_IP=$(echo $INSTANCES | jq '.[0] | .mgmt_address' -r)
USERNAME=$(echo $INSTANCES | jq '.[0] | .admin_username' -r)
PASSWORD=$(echo $INSTANCES | jq '.[0] | .admin_password' -r)
PORT=$(echo $INSTANCES | jq '.[0] | .mgmt_port' -r)

for HOST in ${FIRST_IP}; do
	echo "IP: ${HOST} USER: ${USERNAME} PASSWORD: ${PASSWORD}"
    sshpass -p $PASSWORD scp -o "StrictHostKeyChecking no" -r nodejs/* ${USERNAME}@${HOST}:/var/config/rest/iapps/f5-appsvcs-templates/nodejs
    sshpass -p $PASSWORD scp -o "StrictHostKeyChecking no" -r node_modules/@f5devcentral/f5-fast-core/lib/* ${USERNAME}@${HOST}:/var/config/rest/iapps/f5-appsvcs-templates/node_modules/@f5devcentral/f5-fast-core/lib
    sshpass -p $PASSWORD scp -o "StrictHostKeyChecking no" -r presentation/* ${USERNAME}@${HOST}:/var/config/rest/iapps/f5-appsvcs-templates/presentation/
    sshpass -p $PASSWORD scp -o "StrictHostKeyChecking no" -r lib/* ${USERNAME}@${HOST}:/var/config/rest/iapps/f5-appsvcs-templates/lib/
    sshpass -p $PASSWORD scp -o "StrictHostKeyChecking no" -r templates/bigip-fast-templates/* ${USERNAME}@${HOST}:/var/config/rest/iapps/f5-appsvcs-templates/templatesets/bigip-fast-templates/
    sshpass -p $PASSWORD ssh -o "StrictHostKeyChecking no" ${USERNAME}@${HOST} 'bigstart restart restnoded'
    echo "done with ${HOST}"
done

CURL_FLAGS="--silent --show-error --write-out \n --insecure -u ${USERNAME}:${PASSWORD} --max-time 10"

echo "Waiting for fast/info endpoint to be available"
until curl ${CURL_FLAGS} -o /dev/null --write-out "" --fail 2> /dev/null \
    "https://${FIRST_IP}:${PORT}/mgmt/shared/fast/info"; do
    sleep 1
done

echo "script execution completed"
