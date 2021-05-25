#!/usr/bin/env bash

TARGET="${1:-$BIGIP_TARGET}"
CREDS="${2:-$BIGIP_CREDS}"

if [ -z "$TARGET" ]; then
    echo "Target machine is required for installation."
    exit 0
fi

if [ -z "$CREDS" ]; then
    echo "Credentials [username:password] for target machine are required for installation."
    exit 0
fi

curl -k -u "$CREDS" https://"$TARGET"/mgmt/shared/appsvcs/declare -X DELETE

curl --insecure --silent --show-error -u "$CREDS" https://$TARGET/mgmt/tm/util/bash \
    --write-out "%{http_code}" --output /dev/null \
    -H "Content-Type: application/json" \
    -d '{
        "command": "run",
        "utilCmdArgs": "-c \"tmsh delete ltm data-group internal /Common/f5-appsvcs-templates/dataStore && tmsh delete ltm data-group internal /Common/f5-appsvcs-templates/config && tmsh delete ltm data-group internal /Common/appsvcs/dataStore && bigstart restart restnoded\""
    }'
