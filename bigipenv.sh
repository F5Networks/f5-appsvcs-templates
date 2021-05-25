export BIGIP_CREDS=admin:f5site02

# Dev
export BIGIP_TARGET=bigip-dev:8443

# export BIGIP_TARGET=10.145.86.112

# 13.1
# export BIGIP_TARGET=10.145.67.148:8443

export FAST_BIGIP_USER=$(echo $BIGIP_CREDS | cut -d ':' -f 1)
export FAST_BIGIP_PASSWORD=$(echo $BIGIP_CREDS | cut -d ':' -f 2)
export FAST_BIGIP_HOST=https://$BIGIP_TARGET
export FAST_BIGIP_STRICT_CERT=0
