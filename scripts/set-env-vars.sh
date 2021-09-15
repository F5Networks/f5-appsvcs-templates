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

setVars="export F5_PERF_TRACING_ENABLED=${F5_PERF_TRACING_ENABLED} F5_PERF_TRACING_DEBUG=${F5_PERF_TRACING_DEBUG} F5_PERF_TRACING_ENDPOINT=${F5_PERF_TRACING_ENDPOINT}"
cmd='echo \\\"$(awk -v var='"'""$setVars""'"" 'NR==3{print var}1'"' /etc/bigstart/scripts/restnoded)\\\" > /etc/bigstart/scripts/restnoded'

# TODO: add back
# --write-out "%{http_code}" --output /dev/null \
curl --insecure --silent --show-error -u "$CREDS" https://$TARGET/mgmt/tm/util/bash \
    -H "Content-Type: application/json" \
    -d '{
        "command": "run",
        "utilCmdArgs": "-c \"'"${cmd}"' && bigstart restart restnoded\""
    }'
