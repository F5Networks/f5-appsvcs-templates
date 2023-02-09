.. _temp-list:

Appendix C: F5 BIG-IP FAST Available Templates
==============================================

| BIG-IP FAST comes pre-installed with a base set of templates. Included are templates to deploy virtual servers for basic deployments as well as several example templates. 
| BIG-IP FAST templates are broken into 2 sections; bigip-fast-templates and examples. 
|

The following table lists the template set, the corresponding template(s) and a brief description:

.. list-table::
      :widths: 50 100 200
      :header-rows: 1

      * - Template Set
        - Template Name
        - Description

      * - bigip-fast-templates
        - DNS Application Template
        - Configure high availability and optimization for DNS implementations

      * - bigip-fast-templates
        - HTTP Application Template
        - Configure high availability and optimization for HTTP and HTTPS implementations

      * - bigip-fast-templates
        - LDAP Application Template
        - Configure high availability and optimization for LDAP implementations

      * - bigip-fast-templates
        - Microsoft ADFS Application Template
        - Configure high availability and optimization for Microsoft ADFS implementations

      * - bigip-fast-templates
        - Microsoft Exchange Application Template
        - Configure high availability and optimization for Microsoft Exchange 2016 and 2019 implementations

      * - bigip-fast-templates
        - Microsoft IIS Application Template
        - Configure high availability and optimization for HTTP and HTTPS implementations
      
      * - bigip-fast-templates
        - Microsoft Sharepoint Application Template
        - Configure high availability and optimization for Microsoft Sharepoint 2016 implementations

      * - bigip-fast-templates
        - SMTP Application Template
        - Configure high availability and optimization for SMTP implementations

      * - bigip-fast-templates
        - TCP Application Template
        - Configure high availability and optimization for TCP implementations
      
      * - bigip-fast-templates
        - UDP Application Template
        - Configure high availability and optimization for UDP implementations

      * - bigip-fast-templates
        - HTTP with DNS Wide IP
        - Configure high availability and optimization for DNS WideIP, from FQDN and Virtual Server destination IP, on devices with LTM and GTM provisioned      
      
      * - bigip-fast-templates
        - IIS with DNS Wide IP
        - Configure high availability and optimization for DNS WideIP, from FQDN and Virtual Server destination IP, on devices with LTM and GTM provisioned

      * - bigip-fast-templates
        - Blue/Green Template
        - Divide application traffic between pools by percentage        

      * - examples
        - Simple UDP Application
        - Simple UDP template wuth parameters defined outside of the template

      * - examples
        - Simple UDP Application with IPAM
        - Simple UDP template with IPAM options, see note below
   
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
        - Simple UDP load balancer using the same port on client and server side

      * - examples
        - simple_waf
        - Example of an HTTPS application using an ASM Policy

.. NOTE:: Before the UDP Application with IPAM template can be used, an IPAM provider must be configured on the **Settings** tab.

Please report any issues or an RFE on the `BIG-IP FAST GitHub page <https://github.com/F5Networks/f5-appsvcs-templates>`_ > Issues tab, click New Issue.