.. _temp-list:

Appendix C: FAST Available Templates
====================================

| FAST comes pre-installed with a base set of templates. Included are templates to deploy virtual servers for basic deployments as well as several example templates. 
| FAST templates are broken into 2 sections; bigip-fast-templates and examples. 
|

The following table lists the template set, the corresponding template(s) and a brief description:

.. list-table::
      :widths: 50 40 250
      :header-rows: 1

      * - Template Set
        - Template Name
        - Description

      * - bigip-fast-templates
        - http
        - A template that can be used to manage HTTP and HTTPS deployments

      * - bigip-fast-templates
        - tcp
        - A template that can be used to manage TCP deployments

      * - bigip-fast-templates
        - dns
        - A template that can be used to load balance DNS servers

      * - examples
        - simple_http
        - A simple HTTP application with load balancing

      * - examples
        - simple_https
        - An HTTPS application with load balancing

      * - examples
        - simple_tcp
        - Simple TCP application load balancer

      * - examples
        - simple_udp
        - Simple UDP application

      * - examples
        - simple_udp_defaults
        - Simple UDP load balancer using the same port on client and server side

      * - examples
        - simple_waf
        - Example of an HTTPS application using an ASM Policy
