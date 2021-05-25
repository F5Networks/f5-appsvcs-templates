TARGET="${1:-$BIGIP_TARGET}"
CREDS="${2:-$BIGIP_CREDS}"

if [ -z "$TARGET" ]; then
    echo "Target machine is required."
    exit 0
fi

if [ -z "$CREDS" ]; then
    echo "Credentials [username:password] for target machine are required for installation."
    exit 0
fi


STATUS_CODE=$(curl --insecure --silent --show-error -u "$CREDS" https://$TARGET/mgmt/tm/util/bash \
    --write-out "%{http_code}" --output /dev/null \
    -H "Content-Type: application/json" \
    -d '{
        "command": "run",
        "utilCmdArgs": "-c \"bigstart stop restjavad restnoded; rm -rf /var/config/rest/storage; rm -rf /var/config/rest/index; rm -f /var/config/rest/downloads/*.rpm; rm -f /var/config/rest/iapps/RPMS/*.rpm; rm -rf /var/config/rest/iapps/f5-*; bigstart start restjavad restnoded\""
    }'
)

# Wait for REST framework
# A 502 status code seems to be common and the bash command still executes
if [ "$STATUS_CODE" -eq 200 ] || [ $STATUS_CODE -eq 502 ]; then
    until curl -ku "$CREDS" --write-out "" --fail --silent "https://$TARGET/mgmt/shared/iapp/package-management-tasks/available"; do
        sleep 30
    done
else
    echo "Failed to nuke with status code $STATUS_CODE"
    exit 1
fi
