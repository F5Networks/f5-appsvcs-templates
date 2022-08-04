.. _managing-templates:

Managing FAST Templates
=======================

FAST allows users the flexibility to update F5 supplied templates via the REST API, add new template sets and remove template sets.

Updating F5 Template Sets
-------------------------

| From time to time, the F5 supplied base template sets, those shipped with the RPM, will be updated.
| In versions prior to v1.9, this was a manual process of clicking the "Update" button in the **ACTIONS** column.
| Beginning with v1.9, template updates will automatically be applied during the FAST RPM update installation.
| FAST will receive a push notification if an update has been made to a template set in the main repo, indicated by a tag of **Update Available**.
|
| Template sets can also be updated using the :ref:`REST API for installing Template Sets<install_template>`.
| In the case where a base template set is being updated, the ``POST`` can be sent to ``/mgmt/shared/fast/templatesets`` without first uploading a template set since the template set is already on the BIG-IP.

Adding New Template Sets
------------------------

FAST allows for the addition of custom template sets from a .zip file.
For authoring these custom template sets, see :ref:`Creating New Templates<authoring>`.

| To install a custom template set from the GUI, navigate to the :ref:`FAST Templates tab <deploytab>`, and click the **Add Template Set From** button,  making sure File is chosen from the dropdown list.
| Navigate to the location of the template set .zip file, and click **Open**.
| The added template set will display in the template set list.
|
| FAST also allows for the storing of template sets on GitLab and/or GitHub then upload using the GUI> FAST Templates tab, or with API calls.

GUI Offbox Templates
^^^^^^^^^^^^^^^^^^^^

| The endpoint is **offbox-templatesets** which is used for updating/modifying templatesets.
|
| To install a custom template set from GitHub/GitLab using the GUI, navigate to the :ref:`FAST Templates tab <deploytab>`:
| Using the **Field** dropdown, choose either GitHub or GitLab, then click the **Add Template Set From** button.
| Populate the dialog box with the Repository, Auth Token (if using a private repo), Repository Subdirectory (if used), Git Ref (branch name) and Installed Set Name.
| **Note:** GitLab has as additional field for URL.
| Click **Install** to install the template set.  The template set will show up in the list of available templates.

API Offbox Templates
^^^^^^^^^^^^^^^^^^^^

| To install a custom template set from GitHub/GitLab using API calls with an API platform such as `Postman <https://www.postman.com/product/what-is-postman/>`_:
| Using a **Post** request, the Body will be similar to the following:
|

.. code-block:: json

    {
        "gitHubRepo": <set as variable>
        "gitSubDir": <if appicable>
        "gitToken": <access token if using a private repo>   or 
        "unprotected": true <if using a public repo>
        "gitRef": <branch name>
    }

Once the declaration is posted, the template set will appear on the BIG-IP GUI page in the list of available templates with the GitHub/GitLab logo indicating the installation type.

Managing Offbox Endpoint
^^^^^^^^^^^^^^^^^^^^^^^^

| The offbox-templatesets endpoint is intended to be used for updating/modifying template sets.
| The following is an example of how the endpoint may be used.
|
| Check status: compares with the remote version checking for available updates.
| Example of the POST payload:
|

.. code-block:: json

    {
        "methods": [
            {
                "name": "status"
            }
        ]
    }


.. NOTE:: A gitToken requires read-only permissions and, for security reasons, should be scoped appropriately.

.. seealso:: `Git References <https://git-scm.com/book/en/v2/Git-Internals-Git-References>`_ and `Creating a personal access token <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token>`_


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
