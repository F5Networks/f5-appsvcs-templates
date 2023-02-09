# F5 BIG-IP Application Services Templates (BIG-IP FAST)
BIG-IP FAST templates are an easy and effective way to deploy applications on the BIG-IP system using [BIG-IP AS3](https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/).

The BIG-IP FAST Extension provides a toolset for templating and managing BIG-IP AS3 Applications on BIG-IP.

## Documentation

For more information about BIG-IP FAST, including installation and usage information, see the [BIG-IP FAST Documentation](https://clouddocs.f5.com/products/extensions/f5-appsvcs-templates/latest/)

Class Function Documentation can be generated locally in either html or markdown, using the following commands to create files in the class's directory:
```bash
# default format is html
npm run buildjsdoc

# specify html as the format
npm run buildjsdoc html

# specifiy markdown as the format
npm run buildjsdoc md
```


## Filing Issues and Getting Help

If you come across a bug or other issue, please use [GitHub Issues](https://github.com/F5networks/f5-appsvcs-templates/issues) to submit an issue for our team.
You can also see current known issues on that page.


## Installing the RPM

**Prerequisites**

* BIG-IP, TMOS v13.1 or later.
* BIG-IP AS3 version 3.16 or later must be installed (see the [BIG-IP AS3 Documentation](https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/userguide/installation.html) for details on installing BIG-IP AS3).

### Installing the BIG-IP FAST Extension

1. Download the BIG-IP FAST extension RPM the [GitHub Release](https://github.com/F5networks/f5-appsvcs-templates/releases) Assets.

2. From the BIG-IP system, install the extension by navigating to **iApps > Package Management LX**. Click **Import** and then select the RPM you downloaded.

   * If you are using a BIG-IP version prior to 14.0, before you can use the Configuration utility, you must enable the framework using the BIG-IP command line. From the CLI, type the following command:  ``touch /var/config/rest/iapps/enable``.  You only need to run this command once (per BIG-IP system). This is not necessary with 14.0 and later.

   Once the package is imported, you should see **f5-appsvcs-templates** in the list of installed extensions.

3. Click **iApps > Application Services > Applications LX**.

4. Click **F5 Application Services Templates** to start using BIG-IP FAST.

## Development

Various script used during development are accessed through `npm`:

* To check for lint errors run `npm run lint`
* To run unit tests use `npm test`

Both of these are also run as part of the CI pipeline for this project.

### Building

`rpmbuild` is required to build the RPM.
All other dependencies are handled by NPM (make sure to do an `npm install` before trying to build).

To build everything (recommended), run:

```bash
npm run build
```

To build just the GUI layer, run:

```bash
npm run buildgui
```

To build just the RPM package, run:

```bash
npm run buildrpm
```

The built RPM package and associated sha256 hash will be placed in the `dist` directory.
The package can be installed on a BIG-IP using the usual mechanisms for installing iApp LX packages.
There is also an `install-rpm` script provided in `scripts` that installs the latest RPM found in `dist` to a target BIG-IP via the REST API.

### Perfomance Tracing

BIG-IP FAST supports perfomance tracing using [Jaeger](https://www.jaegertracing.io/).

To build RPM package with all required modules for performance tracing, run:
```bash
npm run buildperf
```

After installing RPM package on the BIGIP system, in order to enable performance tracing, the following environment variables are required to be set on the BIGIP system:

 * F5_PERF_TRACING_ENABLED - boolean flag to enable BIG-IP FAST Perfomance tracing
 * F5_PERF_TRACING_DEBUG - boolean flag to enable additional logging on Jaeger client
 * F5_PERF_TRACING_ENDPOINT - Jaeger url for sending traces (i.e. http://<ip_address>:14268/api/traces)

### Configurable Settings

 * FAST Worker: 
   * FAST_INIT_MAX_RETRIES - integer number which represents retries number used for FAST Worker initialization workflow.
   * FAST_INIT_RETRY_DELAY_IN_MS - milliseconds to delay between retries used within FAST Worker initialization.
   * FAST_PROVISION_CONFIG_CACHE_TTL_IN_MS - milliseconds to define cache live time for Provision Config. 
   
 * AS3 Driver:
   * FAST_PENDING_TASK_POLL_RATE_IN_MS - milliseconds to define AS3 task poll rate.
   * FAST_OP_LOCK_TIMEOUT_IN_MS - milliseconds to wait for AS3 request OpLock.
 
### Logging

All log messages should contain the worker name (BIG-IP FAST Worker) for easier filtering.

The following logging levels are used (from low priority to high):

* fine - lower priority informational messages
* info - higher priority informational messages
* error - recoverable error (e.g., bad requests)
* severe - unrecoverable error

A `finest` is also available, but already gets spammed with a lot of socket information, which makes it a common log level to disable.

All requests and responses are logged at a `fine` log level by default.
Any response that contains an error status code (>=400) will default to an `error`.

**NOTE:** BIG-IP FAST is the next-generation successor to the now deprecated iApps templates. We strongly recommend **not** using both BIG-IP FAST AND iApp templates together as these templating solutions are incompatible with each other. Using both BIG-IP FAST and iApps is likely to create configuration and source-of-truth conflicts, resulting in an undesirable end-state. 

## License

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)

## Copyright

Copyright 2014-2022 F5 Networks Inc.


### F5 Networks Contributor License Agreement

Before you start contributing to any project sponsored by F5 Networks, Inc. (F5) on GitHub, you will need to sign a Contributor License Agreement (CLA).

If you are signing as an individual, we recommend that you talk to your employer (if applicable) before signing the CLA since some employment agreements may have restrictions on your contributions to other projects.
Otherwise by submitting a CLA you represent that you are legally entitled to grant the licenses recited therein.

If your employer has rights to intellectual property that you create, such as your contributions, you represent that you have received permission to make contributions on behalf of that employer, that your employer has waived such rights for your contributions, or that your employer has executed a separate CLA with F5.

If you are signing on behalf of a company, you represent that you are legally entitled to grant the license recited therein.
You represent further that each employee of the entity that submits contributions is authorized to submit such contributions on behalf of the entity pursuant to the CLA.
