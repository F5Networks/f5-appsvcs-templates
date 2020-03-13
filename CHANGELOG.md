# 0.3
## Core
* Fix parsing issues when there are multiple dependencies
* Expand task to include error messages, application name, and tenant name
* Add definitions from external schema to Template view schema

## REST Worker
* Persist template sets to data groups
* Fix deleting template sets
* Fix running on BIG-IP 13.1
* Add initial TEEM integration
* Add template hashes to /info endpoint
* Expand tasks to include error messages, application name, and tenant name
* Log REST responses and requests

## CLI
* Print stack traces on errors

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

# 0.2
## Core
* Various fixes for parsing nested sections and partials
* Allow coercion of sections into strings
* Add defaults for primitive types (default to empty/falsey values)
* Allow getting variable title and descriptions from the template definitions list
 
# 0.1
Initial Release
