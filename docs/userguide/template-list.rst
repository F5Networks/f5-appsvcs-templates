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

      * - bigip-fast-templates
        - ldap
        - A template that can be used to manage LDAP servers

      * - bigip-fast-templates
        - smtp
        - A template that can be used to manage SMTP

      * - bigip-fast-templates
        - microsoft_iis
        - A template that can be used to manage Microsoft IIS servers

      * - bigip-fast-templates
        - microsoft_exchange
        - A template that can be used to manage Exchange servers
      
      * - bigip-fast-templates
        - microsoft_sharepoint
        - A template that can be used to manage SharePoint servers

      * - bigip-fast-templates
        - microsoft_adfs (beta)
        - A template that can be used to manage Active Directory

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


.. NOTE:: The ADFS template is a Beta version.

Please report any issues or an RFE on the `FAST GitHub page <https://github.com/F5Networks/f5-appsvcs-templates>`_ > Issues tab, click New Issue.