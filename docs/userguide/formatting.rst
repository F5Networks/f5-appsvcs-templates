Formatting in sphinx/rst (H1)
=============================
Thought I'd just temporarily put some common sphinx elements here to help whoever is going to do the docs with formatting.  Have to look at the **formatting.rst** file itself for the code.

This is effectively an top level heading (H1).


Sample (H2)
-----------
This is a second level heading.  Note the characters under the heading have to be the same length as the heading itself.

Sample (H3)
^^^^^^^^^^^
This is a Heading 3

Seldom used (H4)
""""""""""""""""
This is a seldom used 4th level heading, as it doesn't really stand out.


General formatting
------------------

This is *italic*

This is **bold**

This shows a couple ways...

|

...you can force line breaks in your text.


You can also just use an HTML block like at the bottom of this file |br| which inserts a 'br' tag and broke this sentence after "file".




.. _linking:

Linking
^^^^^^^
.. sidebar:: :fonticon:`fa fa-info-circle fa-lg` Version Notice:

   This is bit of code that allows you to put a version notice or something else in a right aligned box that applies to this section. 

Here are some examples of how to do links
This is one way to do a `link <www.f5.com>`_

Here is |another| that uses the sphinx ability to pull in straight HTML.

This is a way to reference another :doc:`document <index>` in the same guide.  It could also just be :doc:`index` which pulls in the header from the referenced file.

You can also add an anchor like object (such as the code above this "linking" heading to link to a specific location in a document.  For example, :ref:`this<about>` links to the anchor for the "About" heading in the index.


List examples
^^^^^^^^^^^^^

* This is a bulleted list.
* It has two items, the second
  item uses two lines in the code. (note the indentation)

1. This is a numbered list.
2. It has two items too.


#. This continues the list, but uses a number sign instead of a number, showing it doesn't matter
#. Theres also an extra break in the code above number 3, but it doesn't matter.

|

1. This is a numbered list.
2. But has some sub-bullets.  Note the spacing in the code.

   * This is a numbered list.
   * It has two items too.

3. Continues....


Callout boxes
^^^^^^^^^^^^^
Here are some examples of how to do different callout boxes:

.. NOTE:: This is a note callout

.. IMPORTANT:: This is important!

.. WARNING:: This is a WARNING!



Code blocks
^^^^^^^^^^^
One cool thing with sphinx is it can properly format some code blocks.  For example, JSON:

.. code-block:: json

    {
        "class": "AS3",
        "action": "deploy",
        "persist": true,
        "declaration": {
            "class": "ADC",
            "schemaVersion": "3.0.0",
            "id": "urn:uuid:33045210-3ab8-4636-9b2a-c98d22ab915d",
            "label": "Sample 1",
            "remark": "Simple HTTP Service with Round-Robin Load Balancing"
        }
    }

|

Or another, this time with line numbers and highlighting specific lines, for Python

.. code-block:: python
   :linenos:
   :emphasize-lines: 1, 4

    def all_unique(lst):
      return len(lst) == len(set(lst))

    x = [1,1,2,2,3,2,3,4,5,6]
    y = [1,2,3,4,5]
    all_unique(x) # False
    all_unique(y) # True



Tables
^^^^^^
Tables can be kind of a pain, depending on how you do them.

This is a more complicated way to do a table, but is easily visible in the code.  Note everything has to be formatted exactly or the table won't render:


+--------------------+----------------------+------------+------------------------------------------------------------------------------------------------------------------------------------+
| Parameter          | Options              | Required?  |  Description/Notes                                                                                                                 |
+====================+======================+============+====================================================================================================================================+
| class              | DNS                  |   Yes      | Indicates that this property contains DNS information.                                                                             |
+--------------------+----------------------+------------+------------------------------------------------------------------------------------------------------------------------------------+
| nameServers        | array of strings     |   No       | The nameServers property contains the IP address(es) of name servers to use for DNS, and can be either IPv4 or IPv6 addresses.     |
+--------------------+----------------------+------------+------------------------------------------------------------------------------------------------------------------------------------+
| search             | array of strings     |   No       | The search domain(s) you want to use for DNS. This must be in hostname format.                                                     |
+--------------------+----------------------+------------+------------------------------------------------------------------------------------------------------------------------------------+

You can do the same table in a bit simpler way:

.. list-table::
      :widths: 25 20 20 150
      :header-rows: 1

      * - Parameter
        - Options
        - Required
        - Description/Notes
        
      * - class
        - DNS
        - Yes
        - Indicates that this property contains DNS information. 
    
      * - nameServers
        - array of strings
        - No
        - The nameServers property contains the IP address(es) of name servers to use for DNS, and can be either IPv4 or IPv6 addresses. 

      * - search
        - array of strings
        - No
        - The search domain(s) you want to use for DNS. This must be in hostname format. 


Links
=====
Here are some helpful links:

`Official sphinx docs <https://www.sphinx-doc.org/en/2.0/usage/restructuredtext/basics.html>`_

`Cheatsheet <http://openalea.gforge.inria.fr/doc/openalea/doc/_build/html/source/sphinx/rest_syntax.html>`_

`Intro to sphinx <https://www.writethedocs.org/guide/tools/sphinx/>`_












.. |br| raw:: html

   <br />

.. |another| raw:: html

   <a href="https://github.com/F5Networks/f5-appsvcs-extension" target="_blank">Another</a>



