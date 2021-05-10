.. _managing-templates:

Managing FAST Templates
=======================

FAST allows users the flexibility to update F5 supplied templates via the REST API, add new template sets and remove template sets.

Updating F5 Template Sets
-------------------------

| From time to time, the F5 supplied base template sets, those shipped with the RPM, will be updated.
| In versions prior to v1.9, this was a manual process of clicking the "Update" button in the **ACTIONS** column.
| Beginning with v1.9, template updates will automatically be applied during the FAST RPM update installation.
|
| Template sets can also be updated using the :ref:`REST API for installing Template Sets<install_template>`.
| In the case where a base template set is being updated, the ``POST`` can be sent to ``/mgmt/shared/fast/templatesets`` without first uploading a template set since the template set is already on the BIG-IP.

Adding New Template Sets
------------------------

FAST allows for the addition of custom template sets.
For authoring these custom template sets, see :ref:`Creating New Templates<authoring>`.

| To install a custom template set from the GUI, navigate to the :ref:`FAST Templates tab <deploytab>`, and click the **Add Template Set** button.
| Navigate to the location of the template set .zip file, and click **Open**.
| The added template set will display in the template set list.

Removing Template Sets
----------------------

| FAST allows for the removing of both user added, and RPM installed, template sets.
| From the :ref:`FAST Templates tab<deploytab>`, click the **Remove** button located above the template set.
| A confirmation dialog will display with the options to **Cancel** or **Continue** the removal.
| Template sets that are in-use by a FAST application cannot be removed.

Reinstalling Base Template Sets
-------------------------------

| To reinstall a base Template Set, one that shipped with the RPM, use the :ref:`REST API for installing Template Sets<install_template>`.
| For the Template Set name use ``bigip-fast-templates`` or ``examples``.
