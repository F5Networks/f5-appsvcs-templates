.. _advanced_templates:

Advanced Template Features (with examples)
=========================================
|
| Creating templates covering multiple functions can be quite involved. 
| We will break down some of the advanced techniques used within individual parts of our complex BIG-IP FAST Templates.

.. seealso:: :ref:`Templating with F5 BIG-IP FAST<json>` for information on using Mustache and JSON schema with templating.
    :ref:`Advanced Features<advanced>` for advanced templating types and calls.
    :ref:`Managing F5 BIG-IP FAST Templates<managing-templates>` for information on adding and updating template sets.

BIG-IP FAST Template Parameters
```````````````````````````````

**bigipHideTemplate** instructs FAST to keep the sub-template from being listed as a deployable template.
The bigip-fast-templates template set's ``_as3.yaml`` sub-template uses this property to display its properties in the parent template only:

.. code-block:: yaml
   :emphasize-lines: 3

    title: AS3
    contentType: application/json
    bigipHideTemplate: true
    definitions:
      tenant_name:
        title: Tenant Name
        description: The *tenant* is the high-level grouping in an AS3 declaration. FAST deploys all configuration for a given tenant in a BIG-IP partition of the same name.
        type: string
        minLength: 1
        maxLength: 255
        pattern: ^[A-Za-z][0-9A-Za-z_.-]*$
        immutable: true
      app_name:
        title: Application Name
        description: The *application* is the low-level grouping in an AS3 declaration. FAST deploys all configuration for a given application in a BIG-IP folder within the tenant partition.
        type: string
        minLength: 1
        maxLength: 255
        pattern: ^[A-Za-z][0-9A-Za-z_.-]*$
        immutable: true
    template: |
      {
        "class": "ADC",
        "schemaVersion": "3.0.0",
        "id": "urn:uuid:a858e55e-bbe6-42ce-a9b9-0f4ab33e3bf7",
        "{{tenant_name}}": {
          "class": "Tenant",
          "{{app_name}}": {
            "class": "Application",
            "template": "generic"
          }
        }
      }


**bigipDependencies** is a property that excludes a sub-template if a feature is not installed/provisioned on the BIG-IP; these features include avr, asm, afm, ts and gtm.
The bigip-fast-templates template set's ``http_wideip.yaml`` template uses this property to only display when GTM/DNS is provisioned on the BIG-IP:


.. code-block:: yaml
   :emphasize-lines: 5

    contentType: application/json
    title: HTTP with DNS Wide IP Application Template
    description: Configure high availability w/DNS Wide IP and optimization for HTTP and HTTPS implementations.
    bigipDependencies:
      - gtm
    allOf:
      - $ref: "_as3.yaml#"
      - $ref: "_virtual.yaml#/gtm"
      - $ref: "_redirect_http.yaml#"
      - $ref: "_snat.yaml#"
      - $ref: "_persist.yaml#"
      - $ref: "_tls_server_profile.yaml#/fastl4"
      - $ref: "_tls_client_profile.yaml#/fastl4"
      - $ref: "_pool.yaml#"
      - $ref: "_monitors.yaml#/http"
      - $ref: "_http_profile.yaml#"
      - $ref: "_tcp_profile.yaml#/fastl4"
      - $ref: "_policy_endpoint.yaml#"
      - $ref: "_irule.yaml#"
      - $ref: "_vlan_allow.yaml#"
    anyOf:
      - {}
      - $ref: "_analytics.yaml#/http"
      - $ref: "_analytics.yaml#/tcp"
      - $ref: "_security_policy.yaml#/fastl4"
      - $ref: "_security_firewall.yaml#"
      - $ref: "_security_dos.yaml#/fastl4"
      - $ref: "_shape.yaml#/fastl4"
      - $ref: "_telemetry.yaml#"
    template: |
      {
        "{{tenant_name}}": {
          "{{app_name}}": {
            "{{app_name}}": {
            }
          }
        }
      }


**bigipMaximumVersion** is a property that excludes a sub-template if the BIG-IP version is greater than the version assigned to this value.

**bigipMinimumVersion** is a property that excludes a sub-template if the BIG-IP version is less than the version assigned to this value.
The bigip-fast-templates template set's ``_shape.yaml`` sub-template uses this property to require version 17.0 or greater of the BIG-IP:

.. code-block:: yaml
   :emphasize-lines: 5

   bigipHideTemplate: true

    # Integrated Bot Defense
    ibd_profile: &ibd_profile
      title: Integrated Bot Defense (IBD) Profile
      contentType: application/json
      bigipMinimumVersion: 17.0
      definitions: &ibd_profile_def
        ibd_profile_name: &ibd_profile_name
          title: Existing Integrated Bot Defense (IBD) Profile
          description: Existing IBD profiles are only supported in BIG-IP version 17.0 and greater
          type: string
          enumFromBigip: saas/bd/profile
          default: ''

      ...

--------------------------------


Merging Sub-Templates with $ref
``````````````````````````````

A set of sub-templates can be merged into one single template using the anyOf or allOf, as in the bigip-fast-templates template set's ``dns.yaml`` template:

.. code-block:: yaml
   :emphasize-lines: 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17 

    contentType: application/json
    title: DNS Application Template
    description: Configure high availability and optimization for DNS implementations.
    allOf:
      - $ref: "_as3.yaml#"
      - $ref: "_virtual.yaml#/dns"
      - $ref: "_snat.yaml#/dns"
      - $ref: "_pool.yaml#/dns"
      - $ref: "_monitors.yaml#/dns"
      - $ref: "_irule.yaml#/dns"
    anyOf:
      - {}
      - $ref: "_analytics.yaml#/dns"
      - $ref: "_security_policy.yaml#/dns"
      - $ref: "_security_firewall.yaml#/dns"
      - $ref: "_shape.yaml#/dns"
      - $ref: "_telemetry.yaml#/dns"
    template: |
      {
        "{{tenant_name}}": {
          "{{app_name}}": {
            "{{app_name}}_tcp": {
              "class": "Service_TCP",
              "profileTCP": {
                "ingress": "wan",
                "egress": "lan"
              }
            },
            "{{app_name}}_udp": {
              "class": "Service_UDP",
              "profileUDP": {
                "bigip": "/Common/udp_gtm_dns"
              },
              "profileDNS": {
                "bigip": "/Common/dns"
              }
            }
          }
        }
      }


.. seealso:: `Using $ref -- JSON Schema <https://json-schema.org/understanding-json-schema/structuring.html#ref>`_ 
    for more about merging a schema reference in a sub-template.


Context Specific Sub-Template References
```````````````````````````````````````

You can include a section of a sub-template, reference by a hash argument that follows the file's name in the $ref/reference. 
The bigip-fast-templates template set's ``dns.yaml`` template uses #/dns to specify the following dns specific portion of the ``_virtual.yaml`` sub-template file:

.. code-block:: yaml
   :emphasize-lines: 2

    # subtemplate with VS names unique to DNS template
    dns:
      <<: *virtual_base
      definitions: 
        <<: *virtual_base_def
        virtual_port:
          title: Virtual Server Port
          default: 53
      template: |
          {
            "{{tenant_name}}": {
              "{{app_name}}": {
                "{{app_name}}_tcp": {
                  {{#use_ipam}}
                    "virtualAddresses": ["{{virtual_address_ipam}}"],
                  {{/use_ipam}}
                  {{^use_ipam}}
                    "virtualAddresses": ["{{virtual_address:f5:ipv4_ipv6}}"],
                  {{/use_ipam}}
                  "virtualPort": {{virtual_port:f5:port}}
                },
                "{{app_name}}_udp": {
                  {{#use_ipam}}
                    "virtualAddresses": ["{{virtual_address_ipam}}"],
                  {{/use_ipam}}
                  {{^use_ipam}}
                    "virtualAddresses": ["{{virtual_address:f5:ipv4_ipv6}}"],
                  {{/use_ipam}}
                  "virtualPort": {{virtual_port:f5:port}}
                }
              }
            }
          }
 
--------------------------------


Re-using Schema within a Sub-Template
````````````````````````````````````

The bigip-fast-templates template set uses `YAML Anchors and Aliases <https://yaml.org/spec/1.2.2/#3222-anchors-and-aliases>`_ to set a base configuration that can be reused and overwritten for different contexts.
An example is the ``_virtual.yaml`` sub-template, that creates a &virtual_base Anchor and uses it in a general context (without a hash argument on the $ref), and also overwrites the *virtual_base alias for the fastl4 context.

.. code-block:: yaml
   :emphasize-lines: 3, 48, 54

    bigipHideTemplate: true

    virtual_base: &virtual_base
      contentType: application/json
      definitions: &virtual_base_def
        use_ipam:
          title: Use IPAM Provider
          description: Use an IP Address Management service to get an IP address
          type: boolean
          default: false
        virtual_address:
          title: Virtual Server IP Address
          description: This IP address, combined with the port you specify below, becomes
            the BIG-IP virtual server address and port, which clients use to access the application.
            The system uses this IP:Port for distributing requests to the web servers.
        virtual_address_ipam:
          title: Virtual Server IP Address from IPAM
          description: Select an IPAM Provider to get an IP address from.
            This IP address, combined with the port you specify below, becomes
            the BIG-IP virtual server address and port, which clients use to access the application.
            The system uses this IP:Port for distributing requests to the web servers.
          ipFromIpam: true
          default: ''
        virtual_port:
          title: Virtual Server Port
          default: 443
        virtual_partial_template:
          template: |
                  {
                    "{{tenant_name}}": {
                      "{{app_name}}": {
                        "{{app_name}}": {
                          "virtualAddresses": [
                            {{#use_ipam}}
                              "{{virtual_address_ipam}}"
                            {{/use_ipam}}
                            {{^use_ipam}}
                              "{{virtual_address:f5:ipv4_ipv6}}"
                            {{/use_ipam}}
                          ],
                          "virtualPort": {{virtual_port:f5:port}}
                        }
                      }
                    }
                  }

    # default VS subtemplate
    <<: *virtual_base
    template: |
      {{> virtual_partial_template}}

    # fastl4 subtemplate
    fastl4: &fastl4
      <<: *virtual_base
      definitions: &fastl4_context_def
        <<: *virtual_base_def
        fastl4: &fastl4_prop
          title: Use fastL4 Protocol Profiles
          description: The FastL4 profile can increase virtual server performance and throughput by using the embedded Packet Velocity Acceleration (ePVA) chip to accelerate traffic.
          type: boolean
          default: false
        make_fastl4_profile: &make_fastl4_prop
          title: FAST-Generated fastL4 Protocol Profile
          description: Uncheck to use an existing BIG-IP fastL4 profile.
          type: boolean
          default: true
        fastl4_profile_name: &fastl4_name_prop
          title: fastL4 profile
          description: Select an existing BIG-IP fastL4 profile.
          type: string
          enumFromBigip: ltm/profile/fastl4
          default: "/Common/fastL4"
      template: |
            {
              "{{tenant_name}}": {
                "{{app_name}}": {
                  "{{app_name}}": {
                    "virtualAddresses": [
                      {{#use_ipam}}
                        "{{virtual_address_ipam}}"
                      {{/use_ipam}}
                      {{^use_ipam}}
                        "{{virtual_address:f5:ipv4_ipv6}}"
                      {{/use_ipam}}
                    ],
                    "virtualPort": {{virtual_port:f5:port}},
                    {{#fastl4}}
                      "class": "Service_L4",
                      {{#make_fastl4_profile}}
                        "profileL4": "basic",
                      {{/make_fastl4_profile}}
                      {{^make_fastl4_profile}}
                        "profileL4": {
                          "bigip": "{{fastl4_profile_name}}"
                        },
                      {{/make_fastl4_profile}}
                    {{/fastl4}}
                  }
                }
              }
            }

Referencing a Sub-Template within another Sub-Template
````````````````````````````````````````````````````

The bigip-fast-templates template set's ``_security_policy.yaml`` sub-template can merge the schema of two sub-templates (sub-sub-templates), into a sub-template -- which can be referenced/merged into the top level template's schema.

.. code-block:: yaml
   :emphasize-lines: 10, 32, 42, 54, 66, 67, 68, 69, 70

    bigipHideTemplate: true

    bipMinVer: &bigipMinimumVersion 14.1


    # ASM template base, containing all settings that don't change order (unlike ASM Logging)
    asm_base: &asm_base
      title: Application Security
      contentType: application/json
      anyOf: &asm_base_anyof
        - {}
      definitions:
        asm:
          type: boolean
          default: false
          dependencies: 
            - enable_asm_logging
        afm: 
          type: boolean
          default: false
          dependencies: 
            - enable_asm_logging
      template: |
        {
          "{{tenant_name}}": {
            "{{app_name}}": {
            }
          }
        }

    # ASM Logging
    asm_logging: &asm_logging
      title: ASM Logging
      contentType: application/json
      bigipDependencies:
        - asm
      definitions: &asm_logging_def

      ...

    # AFM Logging
    afm_logging: &afm_logging
      title: AFM Logging
      contentType: application/json
      bigipDependencies:
        - afm
      definitions: *asm_logging_def
      parameters:
        afm: true
      template: |
        {{> asm_partial_template}}

    # WAF Policy
    waf_policy: &waf_policy
      title: WAF Policy
      contentType: application/json
      bigipDependencies:
        - asm
      bigipMinimumVersion: *bigipMinimumVersion
      definitions: &waf_policy_def

      ...

    # subtemplate with basic features: WAF and ASM logging
    <<: *asm_base
    anyOf: 
      - <<: *asm_base_anyof
      - *waf_policy
      - *asm_logging
      - *afm_logging



Overwriting a Property in Alias
```````````````````````````````

The bigip-fast-templates template set's ``_security_policy.yaml`` sub-template shows how we might use an alias to property definitions, *waf_policy_def, and then overwrite an individual property within it: waf_partial_vs

.. code-block:: yaml
   :emphasize-lines: 8, 9, 10, 11, 12, 13, 14, 15

    # subtemplate with VS names unique to DNS template
    dns:
      <<: *asm_base
      anyOf: 
        - <<: *asm_base_anyof
        - <<: *waf_policy
          definitions: 
            <<: *waf_policy_def
            waf_partial_vs:
              template: |
                "{{app_name}}_udp": {
                  {{> waf_partial_profiles}}
                },
                "{{app_name}}_tcp": {
                  {{> waf_partial_profiles}}
                },

-----------

Displaying Properties Conditionally
```````````````````````````````````

The bigip-fast-templates template set's ``_pool.yaml`` sub-template can display only the properties that relate to the selected Service Discovery Type, as we see in this snippet:

.. code-block:: yaml
   :emphasize-lines: 22, 37, 38

    service_discovery:
      title: Pool Members
      description: Configure Pool Member Address Discovery.
      type: array
      ...

      items:
        title: Type
        type: object
        properties:
          sd_port:
            title: Port
            type: integer
            minLength: 1
            propertyOrder: 0
            default: 80
            options:
              input_width: 100px
          sd_type:
            title: Type
            type: string
            enum: ["fqdn", "event", "aws", "gce", "azure", "consul"]
            propertyOrder: 1
            default: "event"
            options:
              input_width: 100px
              enum_titles: ["FQDN", "Event", "AWS", "GCE", "Azure", "Consul"]
          sd_host:
            title: "   "
            description: "FQDN"
            type: string
            pattern: '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]|()$'
            maxLength: 255
            propertyOrder: 2
            options: &sd_fqdn
              input_width: 100px
              dependencies:
                sd_type: ["fqdn"]