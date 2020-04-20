#!/bin/bash

DIR="templates/bigip-fast-templates"

# create tcp.yaml from http.yaml
cp ${DIR}/http.yaml ${DIR}/tcp.yaml

# replace http monitor choices with tcp monitor
echo -e '/^  app_pool_def:
/enable_tls_client
d
s/  /
s/https/tcp
+1,+4d
w
q' | ed ${DIR}/tcp.yaml

# change initial persistence choices
echo -e '/^  persistence_type: cookie
s/cookie/source-address
/^  enable_fallback_persistence: true
s/true/false
w
q' | ed ${DIR}/tcp.yaml

# remove http-specific properties from service definition
echo -e '/"template": "https"
s/https/tcp
/Service_HTTPS
s/Service_HTTPS/Service_TCP
/> app_tls_server_def
+0,+2d
/> service_tls_server
+0,+6d
w
q' | ed ${DIR}/tcp.yaml