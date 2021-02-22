# 1.7.0
## Added
* Add /settings endpoint
* Add config information to /info endpoint
* Add GUI front-end (Settings tab) for settings endpoint
* driver: Allow automatically setting up log forwarding for Telemetry Streaming
* Add 'ts' as a valid bigipDependencies keyword
* bigip-fast-templates: Add Telemetry Streaming option
* bigip-fast-templates: Add supported version of the Microsoft Exchange template

## Fixed
* Improve load times of templates with many sub-templates
* Fix template dependency checking not working on subsequent template loads

## Changed
* GUI: Open links from Markdown descriptions in new tabs
* GUI: Display full template text when using View Template button
* Update f5-fast-core from v0.10.0 to v0.11.0

# 1.6.1
## Fixed
* Fix "F5 Application Services Templates" not appearing in iApps LX applications list

# 1.6.0
## Changed
* bigip-fast-templates: Remove titles from monitor_timeout parameters
* GUI: Display an error if AS3 is not available
* GUI: Report template errors in the Template tab
* bigip-fast-templates: Add a default pool member
* Update f5-fast-core from v0.9.0 to v0.10.0

# 1.5.0
## Added
* GUI: Support Markdown in schema descriptions
* GUI: Clicking on an application name in the Application List tab now modifies the application
* bigip-fast-templates: Add Microsoft Sharepoint template (experimental/beta)
* bigip-fast-templates: Add Microsoft Exchange template (experimental/beta)
* bigip-fast-templates: Add Microsoft ADFS template (experimental/beta)
* bigip-fast-templates: Add Microsoft IIS template
* bigip-fast-templates: Add SMTP template
* bigip-fast-templates: Add LDAP template
* bigip-fast-templates: Add firewall feature to DNS, TCP, and HTTP templates
* bigip-fast-templates: Add configurable monitors to TCP and HTTP templates
* bigip-fast-templates: Allow for more advanced pool member configuration in TCP and HTTP templates
* Allow hiding templates from REST/GUI with bigipHideTemplate template property
* Allow specifying a minimum AS3 version for a given template (bigipMinimumAS3 template property)

## Fixed
* GUI: Fix handling of undefined values in the base64 editor
* worker: Fix hydrating enumFromBigip on multiple properties with "items" sub-properties

## Changed
* Improve performance when working with many FAST applications
* bigip-fast-templates: Improve prompts and descriptions of various parameters
* GUI: Improve displaying errors when managing template sets
* bigip-fast-templates: Update existing applications to use the new pool members definition
* Update f5-fast-core from v0.8.0 to v0.9.0
* driver: Add "f5-appsvcs-templates" userAgent string to AS3 declarations

# 1.4.0
## Added
* Allow retrieving failed application submissions to modify and resubmit
* bigip-fast-templates: Add DNS template
* bigip-fast-templates: Add iRules to both TCP and HTTP templates

## Fixed
* Fix REST worker error when loading a template with schema that has no properties defined
* Cleanup task messages on BIG-IPs with multiple tenants
* Fix 404 error when attempting to load the GUI before restnoded is ready

## Changed
* Use template merging to reduce duplication between TCP and HTTP templates
* Update style to better match BIG-IP GUI
* Make editor form titles more consistent in the Deploy tab

# 1.3.0
## Added
* Support enumFromBigip on array items
* GUI: Add textboxes that can output base64 strings when a template is rendered
* Templates: Add option to get variable values from HTTP requests
* GUI: Use JSON Editor 'select' format for arrays of unique enum items
* bigip-fast-templates: Support using the same TCP profile for both ingress and egress traffic

## Fixed
* bigip-fast-templates/tcp: Fix enumFromBigip for monitor_name
* Fix 500 error when invalid template sets are used
* GUI: Improve filtering extra properties when using template merging
* GUI: Improve form render order when using allOf

## Changed
* Use AS3's optimistic locking to detect synchronization issues between FAST and AS3
* Templates: Return an empty array instead of undefined when transforming an undefined array

# 1.2.0
## Added
* Add confirmation dialogs to dangerous operations
* Add spinner loader to indicate when page is loading
* Improve error output when a template fails to render in the GUI
* Improve error output for bad "name" property on POST to /applications
* Improve error output for missing "name" or "parameters" property on POST to /applications
* Add showDisabled query parameter to GET on /templatesets for showing disabled template sets
* Support PATCH on /applications/{tenant}/{app} endpoint for partial modifications of existing applications
* Add template set hash (setHash) to application data
* Add accordion to the template sets on the deploy page
* Add additional status reporting for tasks in the Deploy Log
* Add filter to Templates Page
* Add disabled templatesets to the Templates Page
* Add install button to templatesets

## Fixed
* Stop printing empty strings to the console
* Work-around iControl replacing error messages with "HTML Tag-like Content in Request URL/Body"
* Fix broken alignment across all tables

## Changed
* Reduce latency on the /templatesets endpoint
* Restrict allowed characters for tenant and application names on bigip-fast-templates
* Stop allowing the deletion of in-use template sets

# 1.1.0
## Added
* Support DELETE on /applications endpoint (deletes all applications managed by FAST)
* Support DELETE on /templatesets endpoint (deletes all installed templates)
* Support combining templates via oneOf/allOf/anyOf
* Support $ref in template definitions (http $refs are not supported)

## Fixed
* Fix enumFromBigip error when endpoint does not contain "items"

## Changed
* Request IDs in the REST worker log have been switch from uuid4 IDs to an incrementing counter
* Deleting a base template set persists through a reboot
* Improved error reporting when a template fails to load
* GUI updated to better match the look and feel of the rest of the BIG-IP GUI
* Empty template sets no longer pass validation
* Under Templates, moved 'supported' away from middle column into a tooltipped f5 logo
* Under Templates, more than two apps will now be expandable

## Removed

# 1.0.0
## Added
* POST to /applications can now take an array of applications
* Better support for external schema references when using the FAST CLI
* packageTemplateSet command in the FAST CLI
* enumFromBigip property for use in templates to create a enum from BIG-IP queries
* SNAT, Persistence, and support for various profiles added to the HTTP and TCP templates

## Fixed
* GUI elements not showing/hiding consistently
* JSHINT errors showing up in restnoded log when loading the REST worker
* Ajv warnings when using text, hidden, or password formats

## Changed
* Print better errors when schema validation fails using the FAST CLI
* Do not mark properties with the "hidden" format as required
* Stop logging the bodies of REST responses and requests in the REST worker
* Use ReDoc instead of Swagger-UI for the API docs tab
* Cleaned up titles and descriptions in bigip-fast-templates templates
* Template sections now default to arrays instead of booleans
  * This can be overridden by giving a section variable a type of "boolean"

## Removed

# 0.3.0
## Core
* Fix parsing issues when there are multiple dependencies
* Expand task to include error messages, application name, and tenant name
* Add definitions from external schema to Template view schema
* Add hashes for templates and template sets

## REST Worker
* Persist template sets to data groups
* Fix deleting template sets
* Fix running on BIG-IP 13.1
* Add initial TEEM integration
* Add template hashes to /info endpoint
* Add schema and schema hashes to /info endpoint
* Expand tasks to include error messages, application name, and tenant name
* Log REST responses and requests

## CLI
* Print stack traces on errors
* Add new htmlpreview command
* Ship stand-alone binary builds of the CLI
* Form buttons (e.g., "View Template") in the Deploy tab are disabled until a template is loaded

## GUI
* Set iApps LX application state to BOUND instead of UNBOUND (dot is now green)
* Auto-refresh the Deploy Log when there is an "in progress" task
* Add buttons to add and remove template sets
* Add button to update template sets that are out-of-date with what shipped with the RPM
* Show which template sets have a supported hash
* Redirect to the task list after submitting application create/modify/delete tasks
* Use fast/tasks instead of appsvcs/task to gather a task list
* Show errors on create/modify application page load instead of only after changes

## Templates
* bigip-fast-templates: Add validation around minimum values
* bigip-fast-templates/http: Use shareNodes for pool members
* bigip-fast-templates/tcp added

# 0.2.0
## Core
* Various fixes for parsing nested sections and partials
* Allow coercion of sections into strings
* Add defaults for primitive types (default to empty/falsey values)
* Allow getting variable title and descriptions from the template definitions list
 
# 0.1.0
Initial Release
