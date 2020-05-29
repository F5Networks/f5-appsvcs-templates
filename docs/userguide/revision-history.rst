.. _revision-history:

Document Revision History
=========================

.. list-table::
      :widths: 15 100 15
      :header-rows: 1

      * - Doc Revision
        - Description
        - Date

      * - 4.0
        - Updated the documentation for FAST v1.v. This release contains the following changes: |br| * Added support for DELETE on /applications endpoint (deletes all applications managed by FAST) |br| * Added support for DELETE on /templatesets endpoint (deletes all installed templates) |br| * Added support for combining templates via oneOf/allOf/anyOf |br| * Added support for $ref in template definitions (http $refs are not supported) |br| * Request IDs in the REST worker log have been switch from uuid4 IDs to an incrementing counter |br| * Deleting a base template set persists through a reboot |br| * Improved error reporting when a template fails to load |br| * GUI updated to better match the look and feel of the rest of the BIG-IP GUI |br| * Empty template sets no longer pass validation |br| * Under Templates, moved 'supported' away from middle column into a tooltipped f5 logo |br| * Under Templates, more than two apps will now be expandable |br| |br| Issues Resolved: |br| * Fix enumFromBigip error when endpoint does not contain "items" 
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