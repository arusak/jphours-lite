# Keep Routine management in one drawer

The Routine title remains an h1 with a native button opening the existing name editor. A hamburger opens RoutinePicker, which owns Routine selection, creation, deletion, import, and export. Duration precedes the settings summary immediately below the title; RoutineSettings owns expansion and accepts a presentation slot for Duration.

RoutinePicker uses one BottomSheet, switching between its Routine list and import preview. Shared preview markup and useRoutineFileActions also serve the welcome flow. Focus moves to preview content on import and back to Import on cancellation. Successful saving closes the drawer; failed saving retains preview for retry. Export keeps the list and its status visible. Disabled-action explanations are rendered within the active dialog.

Persistence and transitions remain owned by useRoutineEditor. Additive imports, fresh identities, save-before-transition, and access ordering continue to follow [ADR 0009](0009-multiple-local-routines.md). This decision changes presentation and modal ownership without changing storage or portable files.
