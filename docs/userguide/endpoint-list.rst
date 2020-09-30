.. _endpoint-list:

Appendix D: Endpoint List
=========================

On the BIG-IP, there are endpoints that look for the presence of a given file, as specified by a full path name. 

| Below is a comprehensive list of BIG-IP endpoints.
| 
| "endpoint": "/auth/partition"
| "endpoint": "/ltm/data-group/internal"
| "endpoint": "/ltm/data-group/external"
|           
| "endpoint": "/ltm/profile/analytics"  
| "modules": ["avr"]
| 
| "endpoint": "/ltm/profile/tcp-analytics"  
| "modules": ["avr"]
|            
| "endpoint": "/ltm/monitor/dns"
| "endpoint": "/ltm/monitor/external"
| "endpoint": "/ltm/monitor/ftp"
| "endpoint": "/ltm/monitor/http"
| "endpoint": "/ltm/monitor/https"
| "endpoint": "/ltm/monitor/gateway-icmp"
| "endpoint": "/ltm/monitor/radius"
| "endpoint": "/ltm/monitor/sip"
| "endpoint": "/ltm/monitor/smtp"
| "endpoint": "/ltm/monitor/tcp"
| "endpoint": "/ltm/monitor/tcp-half-open"
| "endpoint": "/ltm/monitor/udp"
| "endpoint": "/ltm/monitor/ldap"
| "endpoint": "/ltm/node"
| "endpoint": "/ltm/persistence/cookie"
| "endpoint": "/ltm/persistence/dest-addr"
| "endpoint": "/ltm/persistence/hash"
| "endpoint": "/ltm/persistence/msrdp"
| "endpoint": "/ltm/persistence/source-addr"
| "endpoint": "/ltm/persistence/sip"
| "endpoint": "/ltm/persistence/ssl"
| "endpoint": "/ltm/persistence/universal"
| 
| "endpoint": "/ltm/pool"  
| "expand": true
|            
| "endpoint": "/ltm/policy"  
| "expand": true
|            
| "endpoint": "/ltm/policy-strategy"  
| "expand": true
|    
| "endpoint": "/ltm/profile/client-ldap"
| "endpoint": "/ltm/profile/client-ssl"
| "endpoint": "/ltm/profile/http"
| "endpoint": "/ltm/profile/http2"
| "endpoint": "/ltm/profile/http-compression"
| "endpoint": "/ltm/profile/web-acceleration"
| "endpoint": "/ltm/profile/one-connect"
| "endpoint": "/ltm/profile/sctp"
| "endpoint": "/ltm/profile/server-ssl"
| "endpoint": "/ltm/profile/server-ldap"
| "endpoint": "/ltm/profile/tcp"
| "endpoint": "/ltm/profile/udp"
| "endpoint": "/ltm/profile/fastl4"
| "endpoint": "/ltm/profile/fix"
| "endpoint": "/ltm/profile/ipother"
| "endpoint": "/ltm/profile/radius"
|            
| "endpoint": "/ltm/profile/classification"  
| "modules": ["afm" "apm" "pem"]
|            
| "endpoint": "/ltm/rule"
| "endpoint": "/ltm/snatpool"
|            
| "endpoint": "/ltm/virtual"  
| "expand": true
|            
| "endpoint": "/ltm/virtual-address"
|            
| "endpoint": "/sys/crypto/cert-validator/ocsp"  
| "minimumVersion": "13.0"
|            
| "endpoint": "/sys/file/data-group"
| "endpoint": "/sys/file/ssl-cert"
| "endpoint": "/sys/file/ssl-key"
| "endpoint": "/sys/file/external-monitor"
| "endpoint": "/sys/folder"
| "endpoint": "/sys/log-config/publisher"
| "endpoint": "/sys/log-config/destination/remote-high-speed-log"
| "endpoint": "/sys/log-config/destination/remote-syslog"
| "endpoint": "/sys/log-config/destination/splunk"
|            
| "endpoint": "/asm/policies"  
| "modules": ["asm"]
|            
| "endpoint": "/security/firewall/address-list"  
| "modules": ["afm"]
|            
| "endpoint": "/security/firewall/port-list"  
| "modules": ["afm"]
|            
| "endpoint": "/security/firewall/rule-list"  
| "modules": ["afm"]
|            
| "endpoint": "/security/firewall/policy"  
| "modules": ["afm"]
|            
| "endpoint": "/security/log/profile"  
| "modules": ["afm" "asm"]
| "endpoint": "/security/nat/policy"  
| "modules": ["afm"]
|            
| "endpoint": "/security/nat/source-translation"  
| "modules": ["afm"]
|            
| "endpoint": "/security/ssh/profile"  
| "modules": ["afm"]
|            
| "endpoint": "/sys/icall/script"
| "endpoint": "/sys/icall/handler/periodic"
|            
| "endpoint": "/pem/profile/radius-aaa"  
| "modules": ["pem"]
|            
| "endpoint": "/pem/profile/diameter-endpoint"  
| "modules": ["pem"]
|            
| "endpoint": "/pem/profile/spm"  
| "modules": ["pem"]
|            
| "endpoint": "/pem/profile/subscriber-mgmt"  
| "modules": ["pem"]  
| "minimumVersion": "13.0"
|            
| "endpoint": "/pem/listener"  
| "modules": ["pem"]
|            
| "endpoint": "/pem/policy"  
| "modules": ["pem"]
|            
| "endpoint": "/pem/forwarding-endpoint"  
| "modules": ["pem"]
|            
| "endpoint": "/net/bwc/policy"
|            
| "endpoint": "/pem/interception-endpoint"  
| "modules": ["pem"]
|            
| "endpoint": "/pem/reporting/format-script"  
| "modules": ["pem"]
|            
| "endpoint": "/pem/service-chain-endpoint"  
| "modules": ["pem"]
|            
| "endpoint": "/ltm/profile/dns"
| "endpoint": "/ltm/dns/tsig-key"
| "endpoint": "/ltm/dns/nameserver"
| "endpoint": "/ltm/dns/zone"
| "endpoint": "/ltm/dns/cache/transparent"
| "endpoint": "/ltm/dns/cache/resolver"
| "endpoint": "/ltm/dns/cache/validating-resolver"
|            
| "endpoint": "/gtm/datacenter"  
| "modules": ["gtm"]
|            
| "endpoint": "/gtm/pool/a"  
| "modules": ["gtm"]
|            
| "endpoint": "gtm/pool/aaaa"  
| "modules": ["gtm"]
|            
| "endpoint": "/gtm/pool/cname"  
| "modules": ["gtm"]
|            
| "endpoint": "/gtm/pool/mx"  
| "modules": ["gtm"]
|            
| "endpoint": "/gtm/prober-pool"  
| "modules": ["gtm"]
|           
| "endpoint": "/gtm/server"  
| "modules": ["gtm"]
|            
| "endpoint": "/gtm/wideip/a"  
| "modules": ["gtm"]
|            
| "endpoint": "/gtm/wideip/aaaa"
| "modules": ["gtm"]
|            
| "endpoint": "/gtm/wideip/cname"  
| "modules": ["gtm"]
|            
| "endpoint": "/gtm/wideip/mx"  
| "modules": ["gtm"]
|            
| "endpoint": "/gtm/region"  
| "modules": ["gtm"]
|            
| "endpoint": "/gtm/topology"
| "modules": ["gtm"]
|            
| "endpoint": "/gtm/global-settings/load-balancing"  
| "modules": ["gtm"]
|       
| "endpoint": "/gtm/monitor/http"  
| "modules": ["gtm"]
|            
| "endpoint": "/gtm/monitor/https"  
| "modules": ["gtm"]
| "endpoint": "/gtm/monitor/gateway-icmp"  
| "modules": ["gtm"]
|   
| "endpoint": "/gtm/monitor/tcp"  
| "modules": ["gtm"]
|            
| "endpoint": "/gtm/monitor/udp"  
| "modules": ["gtm"]
|            
| "endpoint": "/security/dos/profile"  
| "modules": ["afm" "asm"]
|            
| "endpoint": "/ltm/profile/request-log"
| "endpoint": "/ltm/profile/websocket"
| "endpoint": "/ltm/profile/rewrite"
| "endpoint": "/mgmt/shared/service-discovery/task"
| "endpoint": "/ltm/profile/stream"
| "endpoint": "/ltm/profile/ftp"
|            
| "endpoint": "/security/bot-defense/profile"  
| "modules": ["asm"]  
|
