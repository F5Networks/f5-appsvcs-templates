.. _revision-history:

Document Revision History
=========================

.. list-table::
      :widths: 15 100 15
      :header-rows: 1

      * - Doc Revision
        - Description
        - Date

      * - 8.0
        - Updated the documentation for FAST v1.5. This release contains the following changes: |br|

      * - 7.0
        - Updated the documentation for FAST v1.4. This release contains the following changes: |br| * Allow retrieving failed application submissions to be modified and resubmitted |br| * Added a DNS template to bigipi-fast-templates |br| * Added iRules to both TCP and HTTP templates |br| |br| Issues Resolved: |br| * Fixed REST worker error when loading a template with schema that has no properties defined |br| * Cleanup task messages on BIG-IPs with multiple tenants |br| * Fixed 404 error when attempting to load the GUI before restnoded is ready |br| |br| Changed: |br| * Use template merging to reduce duplication between TCP and HTTP templates |br| * Update style to better match BIG-IP GUI |br| * Make editor form titles more consistent in the Deploy tab
        - 10-13-20

      * - 6.0
        - Updated the documentation for FAST v1.3. This release contains the following changes: |br| * Added support for enumFromBigip on array items |br| * GUI: Add textboxes that can output base64 strings when a template is rendered |br| * Templates: Add option to get variable values from HTTP requests |br| * GUI: Use JSON Editor 'select' format for arrays of unique enum items |br| * bigip-fast-templates: Support using the same TCP profile for both ingress and egress traffic |br| * Use AS3's optimistic locking to detect synchronization issues between FAST and AS3 |br| * Templates: Return an empty array instead of undefined when transforming an undefined array |br| |br| Issues Resolved: |br| * bigip-fast-templates/tcp: Fix enumFromBigip for monitor_name |br| * Fix 500 error when invalid template sets are used |br| * GUI: Improve filtering extra properties when using template merging |br| * GUI: Improve form render order when using allOf
        - 09-01-20

      * - 5.0
        - Updated the documentation for FAST v1.2. This release contains the following changes: |br| * Added confirmation dialogs to dangerous operations |br| * Added spinner loader to indicate when page is loading |br| * Improved error output for the following: |br| - When a template fails to render in the GUI |br| - For bad *name* property on POST to /applications |br| - For missing *name* or *parameters* property on POST to /applications |br| * Added showDisabled query parameter to GET on /templatesets for showing disabled template sets |br| * Support PATCH on /applications/{tenant}/{app} endpoint for partial modifications of existing applications |br| * Added template set hash (setHash) to application data |br| * Added accordion to the template sets on the deploy page |br| * Added additional status reporting for tasks in the Deploy Log |br| * Added filter to Templates Page |br| * Added disabled templatesets to the Templates Page |br| * Added install button to templatesets |br| * Reduced latency on the /templatesets endpoint |br| * Restrict allowed characters for tenant and application names on bigip-fast-templates |br| * Stopped allowing the deletion of in-use template sets |br| |br| Issues Resolved: |br| * Stopped printing empty strings to the console |br| * Work-around iControl replacing error messages with *HTML Tag-like Content in Request URL/Body* |br| * Fixed alignment issues across all tables
        - 07-17-20

      * - 4.0
        - Updated the documentation for FAST v1.1. This release contains the following changes: |br| * Added support for DELETE on /applications endpoint (deletes all applications managed by FAST) |br| * Added support for DELETE on /templatesets endpoint (deletes all installed templates) |br| * Added support for combining templates via oneOf/allOf/anyOf |br| * Added support for $ref in template definitions (http $refs are not supported) |br| * Request IDs in the REST worker log have been switch from uuid4 IDs to an incrementing counter |br| * Deleting a base template set persists through a reboot |br| * Improved error reporting when a template fails to load |br| * GUI updated to better match the look and feel of the rest of the BIG-IP GUI |br| * Empty template sets no longer pass validation |br| * Under Templates, moved 'supported' away from middle column into a tooltipped f5 logo |br| * Under Templates, more than two apps will now be expandable |br| |br| Issues Resolved: |br| * Fix enumFromBigip error when endpoint does not contain "items" 
        - 06-02-20

      * - 3.0
        - Updated the documentation for FAST v1.0. This release contains the following changes: |br| * Added improved support for external schema references when using the FAST CLI |br| * Added packageTemplateSet commant to the FAST CLI |br| * Added functionality for POST to/applications which can now take an array of applications |br| * Added SNAT, Persistance and support for various profiles to the HTTP and TCP templates |br| * Improved error reporting when schema validation fails using the FAST CLI |br| * Improved titles and descriptions in the bigip-fast-templates |br| * Template sections now default to arrays instead of booleans which can be overwritten by using a section variable type of “boolean” |br| |br| Issues Resolved: |br| * GUI elements were not showing/hiding consistently |br| * JSHINT errors were showing up in restnoded log when loading the REST worker |br| * Aiv warnings when using text, hidden or password formats
        - 04-30-20

      * - 2.0 
        - Updated the documentation for FAST v0.3.0. This release contains the following changes: |br| * Added a TCP template |br| * Added validation around minimum values to bigip-fast-templates |br| * Added use shareNodes for pool members bigip-fast-templates/http |br| * Auto-refresh the Deploy Log when there is an "in progress" task |br| * Added buttons to Add and Remove template sets |br| * Added button to Update template sets that are out-of-date with the RPM |br| * Added support for logging REST responses and requests |br| * Added hashes for templates and template sets to /info endpoint |br| * The Interface now displays which template sets have a supported hash |br| * Added support for showing which template sets have a supported hash |br| * Added schema and schema hashes to /info endpoint |br| * Added initial TEEM integration |br| * Changed the form buttons on the Deploy tab to disable until a template is loaded |br| * Changed iApps LX application state to BOUND instead of UNBOUND.  Status dot on Application Service List is now green |br| |br| Issues Resolved |br| * Fixed an issue deleting template sets |br| * Fixed an issue running FAST on BIG-IP 13.1 |br| * Fixed parsing issues when there are multiple dependencies
        - 03-25-20

      * - 1.0
        - Documentation for the community-supported preview of FAST templates, version 0.2.0.  This release contains the following changes from the v0.1.0 release: |br| * Various fixes for parsing nested sections and partials |br| * Allow coercion of sections into strings |br| * Add defaults for primitive types (default to empty/false values) |br| * Allow getting variable title and descriptions from the template definitions list |br| * Added descriptions and titles added to the HTTP template |br| * Improved ordering of fields in the HTTP template
        - 02-27-20



.. |br| raw:: html

   <br />