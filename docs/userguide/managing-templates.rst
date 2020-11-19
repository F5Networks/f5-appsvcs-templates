.. _managing-templates:

Managing FAST Templates
=======================

FAST allows users the flexibility to update F5 supplied templates, add new template sets and remove user added sets.

Updating F5 Template Sets
-------------------------

From time to time, the F5 supplied base template sets (those shipped with the RPM) will be updated.
When this occurs, the in-use versions of these templates will not automatically update.
This allows users to update FAST will still being able to update templates separately.

The :ref:`Templates tab of the GUI<templatetab>` will indicate if updates to base template sets are available.
If updates are available, an "Update" button will also be present in the **ACTIONS** column.

Template sets can also be updated using the :ref:`REST API for installing Template Sets<install_template>`.
In the case where a base template set is being updated, the ``POST`` can be sent to ``/mgmt/shared/fast/templatesets`` without first uploading a template set since the template set is already on the BIG-IP.

Adding New Template Sets
------------------------

FAST allows for the addition of custom template sets.
For authoring these custom template sets, see :ref:`Creating New Templates<authoring>`.

To install a custom template set from the GUI, navigate to the :ref:`Templates tab <templatetab>`, and click the **Add Template Set** button.
Navigate to the location of the template set .zip file, and click **Open**.
The added templates will display in the template set list.

Removing Template Sets
----------------------

FAST allows for the removing of both user added and RPM installed template sets.
From the :ref:`Templates tab<templatetab>`, under the **ACTIONS** column, click the trash can icon to remove the Template Set.
Template sets that are in-use by a FAST application cannot be removed.

Reinstalling Base Template Sets
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

To reinstall a base Template Set (one that shipped with the RPM), use the :ref:`REST API for installing Template Sets<install_template>`.
For the Template Set name use ``bigip-fast-templates`` or ``examples``.
