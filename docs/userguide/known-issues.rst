Known Issues
============

**Core Issues**

* Rapid sequential template deployments result in AS3 failures (AS3 does not support queuing) 
* Custom template sets are not preserved on package upgrades, reinstalls, or uninstalls 
 
**GUI Issues**

* No template set loading, editing, or deleting 
* No apparent error reporting or status messages during deployment 
* GUI does not follow BIG-IP style guide for fonts, colors, table format 
* Rapid sequential GUI actions cause GUI to freeze (iAppsLX framework issue) 
 
**HTTP Template Issues**

* Template is missing many of the advanced features of the f5.http iApp.  These will be added in subsequent releases.
* Drop-down selector does not include a list of BIG-IP objects 
