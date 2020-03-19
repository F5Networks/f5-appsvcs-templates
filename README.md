# F5 Application Services Templates
F5 Application Services Templates (FAST) are an easy and effective way to deploy applications on the BIG-IP system using [AS3](https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/).  

The FAST Extension provides a toolset for templating and managing AS3 Applications on BIG-IP.

## Support Information

This F5 Application Services Template (FAST) release is a community-supported preview. Your feedback is appreciated.

We will provide a fully F5-supported FAST offering early next calendar quarter (Q2CY20).

### Filing Issues and Getting Help

If you come across a bug or other issue, please use [GitHub Issues](https://github.com/f5devcentral/f5-appsvcs-templates/issues) to submit an issue for our team.
You can also see current known issues on that page.

## Repository Overview

This repo is broken into subprojects

* An NPM package in [core](core)
* An iApps LX package in [iappslx](iappslx)
* A set of default templates in [templates](templates)

Each subproject maintains its own package.json and associated files.
In other words, run `npm` commands for a given subproject in that subproject's directory.

## Installing the RPM

**Prerequisites**

* BIG-IP, TMOS v13.1 or later.
* AS3 version 3.16 or later must be installed (see the [AS3 Documentation](https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/userguide/installation.html) for details on installing AS3).

### Installing the FAST Extension

1. Download the FAST extension RPM the [GitHub Release](https://github.com/f5devcentral/f5-appsvcs-templates/releases) Assets.

2. From the BIG-IP system, install the extension by navigating to **iApps > Package Management LX**. Click **Import** and then select the RPM you downloaded.

   * If you are using a BIG-IP version prior to 14.0, before you can use the Configuration utility, you must enable the framework using the BIG-IP command line. From the CLI, type the following command:  ``touch /var/config/rest/iapps/enable``.  You only need to run this command once (per BIG-IP system). This is not necessary with 14.0 and later. 

   Once the package is imported, you should see **f5-appsvcs-templates** in the list of installed extensions.

3. Click **iApps > Application Services > Applications LX**.

4. Click **F5 Application Services Templates** to start using FAST. 

## Documentation

For more information about FAST, see [FAST Documentation](https://clouddocs.f5.com/products/extensions/f5-appsvcs-templates/latest/)



## License

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)
