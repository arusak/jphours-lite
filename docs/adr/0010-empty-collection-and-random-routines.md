# Keep an empty Routine collection and generate ordinary random Routines

A saved collection may contain zero to 100 Routines. Its canonical empty form has a null selected Routine ID and an empty record list. On first launch the repository persists that empty form. Once the collection key exists, including an empty collection, it is authoritative over the legacy single-Routine key. An empty collection has no selected Routine to load or access.

Deleting the final Routine persists the empty collection and opens the welcome screen. Pending Routine saves are cancelled before the committed empty collection is adopted, so an old debounce cannot recreate the deleted Routine. This supersedes ADR 0009's policy of creating a replacement Routine after final deletion.

The welcome flow can create an ordinary minimal Routine or an ordinary random Routine, and can import a Routine through the existing preview and confirmation flow. Random generation chooses a name and five Exercises at creation time only. It uses five Exercise Durations totalling 20 minutes, 5-second Quick Rests, and a mixed Tempo ordering, producing a 20:20 Session. The generated Routine carries no generation metadata and remains editable, exportable, and compatible with the existing portable file format.

Older builds do not understand the empty collection form, so rolling back after emptying a collection is unsupported. Existing nonempty version-1 collections and legacy migration behavior remain compatible.
