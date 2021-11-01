.. _revision-history:

Document Revision History
=========================

.. list-table::
      :widths: 15 100 15
      :header-rows: 1

      * - Doc Revision
        - Description
        - Date

      * - 17.0 
        - **Updated the documentation for FAST v1.13** |br| This release contains the following changes:  |br| |br| Added: |br| * bigip-fast-templates: option for chain file on TLS Server in Exchange template |br| * ipam: Add support for authorization headers other than basic auth |br| |br| Fixed: |br| * bigip-fast-templates: Fix SameSite=None cookies with a new iRule that adds the secure attribute to all cookies in the Exchange template |br| *bigip-fast-templates: Fix fqdn missing from Exchange services when not using the Common VIP |br| * bigip-fast-templates: Fix the default port for pool members in the LDAP template, and show the password field
        - 11-02-21

      * - 16.0 
        - **Updated the documentation for FAST v1.12** |br| This release contains the following changes:  |br| |br| Fixed: |br| * bigip-fast-templates: Fixed pool members missing on ADFS template unless Certificate Authentication was selected |br| * bigip-fast-templates: Fixed AS3 declaration when using custom persistence profiles |br| * Fixed errors when deleting builtin template sets |br| * Fixed POST to /render and /application endpoints not using hydrated schemas |br| |br| Changed: |br| * gui: Stop showing appended userAgent query parameter on URIs for error messages 
        - 09-21-21

      * - 15.0 
        - **Updated the documentation for FAST v1.11** |br| This release contains the following changes:  |br| |br| Added: |br| * bigip-fast-templates: Allow using IPAM for virtual address |br| * bigip-fast-templates: Add blue-green template modeled after https://github.com/f5devcentral/as3-bluegreen/tree/master/fast |br| * bigip-fast-templates: Allow using IPAM for virtual addresses (feature must be enabled first) |br| |br| Fixed: |br| * bigip-fast-templates: Fix virtual server IP missing on ADFS template unless Certificate Authentication was selected |br| * GUI: Fix 404 error on BIG-IP 13.1 when loading pages immediately after installation or upgrade |br| * GUI: Fix 401 Unauthorized Error when idle timeout is longer than default |br| |br| Changed: |br| * GUI: Add option to show/hide debug buttons on app create/modify page (hidden by default) |br| * GUI: Change debug buttons to a menu with window for code output |br| *	GUI: Do not overwrite existing applications when creating new ones
        - 08-06-21

      * - 14.0 
        - **Updated the documentation for FAST v1.10** |br| This release contains the following changes:  |br| |br| Added: |br| * Add support for IPAM addresses in arrays |br| * Add option for disabling AS3 declaration caching |br| * bigip-fast-templates: Consistently support IPv4 or IPV6 addresses for IP address fields |br| * bigip-fast-templates: Allow route domain suffixes in IP address fields |br| * Add optional userAgent query parameter to all endpoints |br| * Allow an array of endpoints for enumFromBigip |br| * bigip-fast-templates: Allow selecting an existing persistence profile |br| * Add builtin Infoblox IPAM provider type |br| * GUI: Add filter option for tables |br| |br| Fixed: |br| * GUI: Stop prompting for basic auth credentials when embedded in the BIG-IP GUI |br| |br| Changed: |br| * Fix error when using ipFromIpamProvider and there are no configured providers |br| * Disable editor for enums with null as the only value |br| * Improve error messages when IPAM operations fail
        - 06-25-21
      
      * - 13.0
        - **Updated the documentation for FAST v1.9** |br| This release contains the following changes:  |br| |br| Added: |br| * bigip-fast-templates: Add supported version of the Microsoft ADFS template |br| * templates: Add "immutable" property for parameters that should not be edited on application updates |br| * Allow sending a list of applications to delete when sending a DELETE to /applications |br| * driver: Add timestamps to tasks |br| * Return applications using a template when querying the /templatesets endpoint |br| * Add support for query IPAM (IP Address Management) providers from templates |br| |br| Fixed: |br| * bigip-fast-templates: Replace external URL monitor script references with inline scripts |br| * Fix potential issue where FAST could prevent AS3, and some other iApps LX plugins, from starting |br| |br| Changed: |br| * bigip-fast-templates: Make tenant and application names immutable |br| * Automatically update bundled template sets |br| * Overhaul GUI to better streamline the user experience
        - 05-18-21

      * - 12.0
        - **Updated the documentation for FAST v1.8.1** |br| This release contains the following changes:  |br| |br| Fixed: |br| * bigip-fast-templates: Fix missing virtual address when selecting Common VIP in the Microsoft Exchange template |br| * bigip-fast-templates: Fix missing "Automatically manage the TLS client profile" when selecting "TLS CLient" in the Microsoft Exchange template |br| * Fix error when uploading custom template sets to BIG-IP 13.1
        - 04-26-21

      * - 11.0
        - **Updated the documentation for FAST v1.8** |br| This release contains the following changes: |br| |br| Added: |br| * Added /render endpoint |br| * Added support for Local Traffic Policies |br| * Added support for VLAN selection |br| |br| Fixed: |br| * Fixed f5-appsvcs-templates missing after a UCS save/restore |br| * Fixed erroneous template errors on deleted template sets |br| * Fixed error loading templates when template data group gets too large |br| |br| Changed: |br| * Reduced the install size of f5-appsvcs-templates |br| * Use a value of null for enum when hydrating enumFromBigip with 0 items
        - 04-06-21

      * - 10.0
        - **Updated the documentation for FAST v1.7** |br| This release contains the following changes: |br| |br| Added: |br| * Added /settings endpoint |br| * Added config information to /info endpoint |br| * Added GUI front-end (Settings tab) for settings endpoint |br| * driver: Allow automatically setting up log forwarding for Telemetry Streaming |br| * Added 'ts' as a valid bigipDependencies keyword |br| * bigip-fast-templates: Add supported version of the Microsoft Exchange template |br| * bigip-fast-templates: Add option to use log forwarding traffic logs for Telemetry Streaming |br| |br| Fixed: |br| * Improved load times of templates with many sub-templates |br| * Fixed template dependency checking not working on subsequent template loads |br| |br| Changed: |br| * GUI: Open links from Markdown descriptions in new tabs |br| * GUI: Display full template text when using View Template button |br| * Update f5-fast-core from v0.10.0 to v0.11.0
        - 02-23-21

      * - 9.0
        - **Updated the documentation for FAST v1.6** |br| This release contains the following changes: |br| |br| * bigip-fast-templates: Remove titles from monitor_timeout parameters |br| * GUI: Display an error if AS3 is not available |br| * GUI: Report template errors in the Template tab |br| * bigip-fast-templates: Add a default pool member |br| * Update f5-fast-core from v0.9.0 to v0.10.0
        - 01-12-21

      * - 8.0
        - **Updated the documentation for FAST v1.5** |br| This release contains the following changes:  |br| |br| Added: |br| * GUI: Support Markdown in schema descriptions |br| * GUI: Clicking on an application name in the Application List tab now modifies the application |br| * bigip-fast-templates: Add Microsoft SharePoint template (experimental/beta) |br| * bigip-fast-templates: Add Microsoft Exchange template (experimental/beta) |br| * bigip-fast-templates: Add Microsoft ADFS template (experimental/beta) |br| * bigip-fast-templates: Add Microsoft IIS template |br| * bigip-fast-templates: Add SMTP template |br| * bigip-fast-templates: Add LDAP template |br| * bigip-fast-templates:   Add firewall feature to TCP and HTTP templates |br| * bigip-fast-templates: Add configurable monitors to TCP and HTTP templates |br| * Allow hiding templates from REST/GUI with bigipHideTemplate template property |br| * Allow specifying a minimum AS3 version for a given template (bigipMinimumAS3 template property) |br| * bigip-fast-templates: Allow for more advanced pool member configurations in TCP and HTTP templates |br| |br| Issues Resolved: |br| * GUI: Fix handling of undefined values in the base64 editor |br| * worker: Fix hydrating enumFromBigip on multiple properties with "items" sub-properties |br| |br| Changed: |br| * Improved performance when working with many FAST applications |br| * bigip-fast-templates: Improve prompts and descriptions of various parameters |br| * GUI: Improve displaying errors when managing template sets |br| * bigip-fast-templates: Update existing applications to use the new pool members definition |br| * Updated f5-fast-core from v0.8.0 to v0.9.0 |br| * driver: Add "f5-appsvcs-templates" userAgent string to AS3 declarations
        - 11-20-20

      * - 7.0
        - **Updated the documentation for FAST v1.4** |br| This release contains the following changes:  |br| |br| Added: |br| * Allow retrieving failed application submissions to be modified and resubmitted |br| * Added a DNS template to bigipi-fast-templates |br| * Added iRules to both TCP and HTTP templates |br| |br| Issues Resolved: |br| * Fixed REST worker error when loading a template with schema that has no properties defined |br| * Cleanup task messages on BIG-IPs with multiple tenants |br| * Fixed 404 error when attempting to load the GUI before restnoded is ready |br| |br| Changed: |br| * Use template merging to reduce duplication between TCP and HTTP templates |br| * Update style to better match BIG-IP GUI |br| * Make editor form titles more consistent in the Deploy tab
        - 10-13-20

      * - 6.0
        - **Updated the documentation for FAST v1.3** |br| This release contains the following changes:  |br| |br| Added: |br| * Added support for enumFromBigip on array items |br| * GUI: Add textboxes that can output base64 strings when a template is rendered |br| * Templates: Add option to get variable values from HTTP requests |br| * GUI: Use JSON Editor 'select' format for arrays of unique enum items |br| * bigip-fast-templates: Support using the same TCP profile for both ingress and egress traffic |br| * Use AS3's optimistic locking to detect synchronization issues between FAST and AS3 |br| * Templates: Return an empty array instead of undefined when transforming an undefined array |br| |br| Issues Resolved: |br| * bigip-fast-templates/tcp: Fix enumFromBigip for monitor_name |br| * Fix 500 error when invalid template sets are used |br| * GUI: Improve filtering extra properties when using template merging |br| * GUI: Improve form render order when using allOf
        - 09-01-20

      * - 5.0
        - **Updated the documentation for FAST v1.2** |br| This release contains the following changes:  |br| |br| Added: |br| * Added confirmation dialogs to dangerous operations |br| * Added spinner loader to indicate when page is loading |br| * Improved error output for the following: |br| - When a template fails to render in the GUI |br| - For bad *name* property on POST to /applications |br| - For missing *name* or *parameters* property on POST to /applications |br| * Added showDisabled query parameter to GET on /templatesets for showing disabled template sets |br| * Support PATCH on /applications/{tenant}/{app} endpoint for partial modifications of existing applications |br| * Added template set hash (setHash) to application data |br| * Added accordion to the template sets on the deploy page |br| * Added additional status reporting for tasks in the Deploy Log |br| * Added filter to Templates Page |br| * Added disabled templatesets to the Templates Page |br| * Added install button to templatesets |br| * Reduced latency on the /templatesets endpoint |br| * Restrict allowed characters for tenant and application names on bigip-fast-templates |br| * Stopped allowing the deletion of in-use template sets |br| |br| Issues Resolved: |br| * Stopped printing empty strings to the console |br| * Work-around iControl replacing error messages with *HTML Tag-like Content in Request URL/Body* |br| * Fixed alignment issues across all tables
        - 07-17-20

      * - 4.0
        - **Updated the documentation for FAST v1.1** |br| This release contains the following changes:  |br| |br| Added: |br| * Added support for DELETE on /applications endpoint (deletes all applications managed by FAST) |br| * Added support for DELETE on /templatesets endpoint (deletes all installed templates) |br| * Added support for combining templates via oneOf/allOf/anyOf |br| * Added support for $ref in template definitions (http $refs are not supported) |br| * Request IDs in the REST worker log have been switch from uuid4 IDs to an incrementing counter |br| * Deleting a base template set persists through a reboot |br| * Improved error reporting when a template fails to load |br| * GUI updated to better match the look and feel of the rest of the BIG-IP GUI |br| * Empty template sets no longer pass validation |br| * Under Templates, moved 'supported' away from middle column into a tooltipped f5 logo |br| * Under Templates, more than two apps will now be expandable |br| |br| Issues Resolved: |br| * Fix enumFromBigip error when endpoint does not contain "items" 
        - 06-02-20

      * - 3.0
        - **Updated the documentation for FAST v1.0** |br| This release contains the following changes:  |br| |br| Added: |br| * Added improved support for external schema references when using the FAST CLI |br| * Added packageTemplateSet commant to the FAST CLI |br| * Added functionality for POST to/applications which can now take an array of applications |br| * Added SNAT, Persistance and support for various profiles to the HTTP and TCP templates |br| * Improved error reporting when schema validation fails using the FAST CLI |br| * Improved titles and descriptions in the bigip-fast-templates |br| * Template sections now default to arrays instead of booleans which can be overwritten by using a section variable type of “boolean” |br| |br| Issues Resolved: |br| * GUI elements were not showing/hiding consistently |br| * JSHINT errors were showing up in restnoded log when loading the REST worker |br| * Aiv warnings when using text, hidden or password formats
        - 04-30-20

      * - 2.0 
        - **Updated the documentation for FAST v0.3.0** |br| This release contains the following changes:  |br| |br| Added: |br| * Added a TCP template |br| * Added validation around minimum values to bigip-fast-templates |br| * Added use shareNodes for pool members bigip-fast-templates/http |br| * Auto-refresh the Deploy Log when there is an "in progress" task |br| * Added buttons to Add and Remove template sets |br| * Added button to Update template sets that are out-of-date with the RPM |br| * Added support for logging REST responses and requests |br| * Added hashes for templates and template sets to /info endpoint |br| * The Interface now displays which template sets have a supported hash |br| * Added support for showing which template sets have a supported hash |br| * Added schema and schema hashes to /info endpoint |br| * Added initial TEEM integration |br| * Changed the form buttons on the Deploy tab to disable until a template is loaded |br| * Changed iApps LX application state to BOUND instead of UNBOUND.  Status dot on Application Service List is now green |br| |br| Issues Resolved |br| * Fixed an issue deleting template sets |br| * Fixed an issue running FAST on BIG-IP 13.1 |br| * Fixed parsing issues when there are multiple dependencies
        - 03-25-20

      * - 1.0
        - **Documentation for the community-supported preview of FAST templates, version 0.2.0**  |br| This release contains the following changes from the v0.1.0 release: |br| |br| * Various fixes for parsing nested sections and partials |br| * Allow coercion of sections into strings |br| * Add defaults for primitive types (default to empty/false values) |br| * Allow getting variable title and descriptions from the template definitions list |br| * Added descriptions and titles added to the HTTP template |br| * Improved ordering of fields in the HTTP template
        - 02-27-20



.. |br| raw:: html

   <br />