.. _managing-templates:

Managing FAST Templates
=======================

FAST allows users the flexibility to update F5 supplied templates, add new template sets and remove user added sets.

|

Updating F5 Template Sets
-------------------------

From time to time, the F5 supplied template RPM may be updated. When this occurs, the following steps can be followed to update your system:

1. Navigate to **iApps > Package Management LX**
2. Click **Import**
3. Click **Choose File** navigating to the location of the RPM File
4. Click **Upload** (if the package has already been installed it will be noted)

The Version number, Build (if applicable) , and Package name will update.

.. NOTE:: The templates will not auto-update, however an **Update** button will appear on the Templates tab. Clicking the **Update** button will update the template without additional user input.


Adding New Template Sets
------------------------

FAST allows for the addition of pre-configured template sets in .zip file format. 
From the Templates tab, click the **Add Template Set** button.  Navigate to the location of the template set .zip file, click **Open**.  The added templates will display in the template list.


Removing Template Sets
----------------------

FAST allows for the removing of both user added and RPM installed template sets.  From the Templates tab, under the Actions column, click the trash can icon to remove the Template Set.

.. NOTE:: Use caution when Removing a template set as it is a permanent action.

Reinstalling Base Template Sets
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

To reinstall a base Template Set (one that shipped with the RPM), use the :ref:`REST API for installing Template Sets<install_template>`.
For the Template Set name use ``bigip-fast-templates`` or ``examples``.

|
