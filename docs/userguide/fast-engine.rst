The FAST Engine
===============

The sections here provide an overview of how FAST works, and how templates
are processed in the system. Understanding how FAST works should aid in creating
sound templates and debugging the system when things don't go as expected.

Template to Schema
------------------
Placeholder

Application Creation
--------------------

The process for creating a new application looks something like this: 

**Form field submission -> pre-processing -> rendering -> deploy**

The user enters the configuration parameters into the form, then hits the submit
button. Parameters are packaged up into a JSON object and sent to the system for
pre-processing, most variables will be untouched during pre-processing so we can
set it aside for now. The object is then sent to the render phase, this is where
the form values are actually filled into the provided template. Finally, we
deploy the application to AS3.

Template Validation
-------------------
Placeholder

Schema Generation
-----------------
Placeholder

Template Storage
----------------
Templates are stored internally in datagroups. These datagroups can be found...
