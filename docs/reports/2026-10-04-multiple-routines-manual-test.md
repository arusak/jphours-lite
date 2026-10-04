# Multiple local Routines manual test

This is a test guide, not a record of completed browser checks.

## Prerequisites and cleanup

Run `pnpm dev` and open the displayed URL in a disposable browser profile. Use one tab, browser developer tools, and a 320 px viewport for the narrow-screen checks. Keep the Network panel available for offline testing. Never delete storage in a normal profile: if testing there is unavoidable, export the selected Routine and copy the exact values of both `rhythm-practice-trainer/routine` and `rhythm-practice-trainer/routines` before starting.

At completion, restore any overridden browser methods, remove the disposable profile, and stop the development server. If a normal profile was used, restore both saved storage values exactly, removing a key only if it was originally absent, then reload. Remove only these test keys; do not clear all browser storage.

## Fresh installation, creation, and editing

1. Open the app with both Routine storage keys absent. Expect one selected **Practice routine**, with one default **Exercise** and the existing default settings.
2. Open **Routines** beside Import and Export. Expect a bottom sheet with the selected indicator and calculated duration. Tab through its controls, dismiss with Escape, and check focus returns to the trigger. Repeat with backdrop dismissal.
3. Edit the Routine name and an Exercise, then immediately open the drawer and choose **New routine**. Expect the original edits to be saved and a selected **New routine** with one default Exercise. Reload and expect New routine to reopen.
4. Create more Routines. Expect **New routine 2**, **New routine 3**, and so on. Delete New routine 2 and create again; expect its numbering gap to be reused. Rename another Routine to a duplicate name; expect the existing rename behavior to permit it.
5. Switch to the original Routine and verify its edits. Opening the selected row should only close the drawer. Wait beyond the 300 ms save delay after switches and reload; expect neither the selection nor saved edits to revert.

## Ordering, restoration, and mobile layout

1. Open several different Routines in turn. Expect the most recently opened first, and reopening one moves it to the top. Opening the already selected row leaves ordering unchanged.
2. Edit, export, open and dismiss the drawer, and start and exit a Session. Expect these actions to leave access ordering unchanged. Reload; expect the selected Routine to restore and its startup access time to update.
3. In developer tools, change `selectedRoutineId` in the collection to a fresh `crypto.randomUUID()` and reload. Expect the most recently accessed stored Routine to open, preserving all Routines.
4. Rename a Routine to a long valid name, set viewport width to 320 px, and open the drawer. Expect readable/truncated names, visible totals, and usable selection, delete, Cancel, and slide controls without horizontal overflow.
5. Turn the browser offline, make an edit, switch Routines, and reload. Expect saved content and selection to persist locally. Return online afterward.

## Pointer and keyboard deletion

1. Activate a row's specifically named delete button. Expect only that row to show **Slide to delete** and **Cancel**. Activate a second row's delete button; expect its confirmation to replace the first.
2. Drag the slide control a short distance, release before the threshold, and verify nothing is deleted. Test pointer cancellation and verify the same. Use Cancel, Escape, and backdrop dismissal separately; reopening should show normal rows.
3. Slide past the confirmation threshold using mouse or touch. Expect exactly one deletion, no accidental selection, no second dialog, and the drawer to remain open with normal rows.
4. Confirm another deletion using the slide control's supported keyboard keys (arrow keys or End). Verify an incomplete keyboard gesture does not delete. Delete a nonselected Routine; expect selection to stay unchanged.
5. Delete the selected Routine with other Routines remaining. Expect the most recently accessed remaining Routine to open and record access. Delete all remaining Routines; expect one selected **Practice routine** with one default Exercise.
6. Make an edit, then immediately delete that Routine. Advance real time beyond 300 ms and reload; expect the deleted Routine not to return.

## Import, export, and full capacity

1. Export the selected Routine. Inspect JSON: expect the existing `jphours-routine` format and no collection envelope, local Routine/entry IDs, or access timestamps. Import it into a separate disposable profile and verify equivalent content with fresh IDs.
2. Edit a Routine, choose Import, select the exported file, and inspect its preview. Cancel; expect no addition and pending edits retained. Repeat and choose **Add routine**; expect a new selected Routine, with the original Routine and its edits preserved.
3. Confirm existing invalid-file, unsupported-version, and oversized-file errors remain actionable. A failed or cancelled file selection should not add a Routine.
4. For a quick capacity fixture, create one valid collection through the app, then execute the following in the disposable profile's developer console and reload:

   ```js
   const key = "rhythm-practice-trainer/routines";
   const collection = JSON.parse(localStorage.getItem(key));
   const template = collection.routines[0];
   collection.routines = Array.from({ length: 100 }, (_, index) => {
     const routine = structuredClone(template.routine);
     routine.id = crypto.randomUUID();
     routine.name = `Capacity routine ${index + 1}`;
     routine.entries = routine.entries.map((entry) => ({ ...entry, id: crypto.randomUUID() }));
     return { routine, lastAccessedAt: template.lastAccessedAt };
   });
   collection.selectedRoutineId = collection.routines[0].routine.id;
   localStorage.setItem(key, JSON.stringify(collection));
   location.reload();
   ```

5. Expect New routine and Import to be disabled, with visible explanation: **You can save up to 100 routines. Delete a routine to add another.** Check disabled controls reference that explanation for accessibility. Existing Routines should remain editable, exportable, and openable.
6. Delete one row; expect creation and import to become available immediately. Open an import preview at 99, then append a valid cloned record through developer tools to reach 100 before confirming. Expect **Add routine** to fail without discarding the preview or replacing current content. Remove that extra fixture record and retry; expect success.

## Legacy migration and blocked initialization

1. In a disposable profile, export/copy a valid Routine from `collection.routines[0].routine`, place its JSON under `rhythm-practice-trainer/routine`, and remove only the collection key. Reload. Expect a one-Routine collection preserving content, entry order, settings, and valid IDs; the old key should remain byte-for-byte unchanged. Repeat with a supported version 1 fixture from the persistence tests.
2. Put malformed JSON under the collection key and reload. Expect an App storage error with **Retry**, no editor, and unchanged malformed bytes. Repeat with an unsupported `storageVersion`, duplicate Routine IDs, and more than 100 valid records. Expect no silent replacement or truncation.
3. Restore valid collection bytes without reloading and activate Retry. Expect the selected Routine to open. Repeat with a valid collection whose selected ID is missing; expect the most recently accessed Routine fallback.

## Save failure and retry

1. Preserve the current collection bytes. In the disposable profile console, override writes to the collection only:

   ```js
   window.originalRoutineSetItem = Storage.prototype.setItem;
   Storage.prototype.setItem = function (key, value) {
     if (key === "rhythm-practice-trainer/routines") {
       throw new DOMException("Manual quota test", "QuotaExceededError");
     }
     return window.originalRoutineSetItem.call(this, key, value);
   };
   ```

2. Edit the name, wait for autosave, and expect a visible actionable error. Attempt switching, creation, deletion, and import confirmation. Expect current edits and selection to remain, stored bytes to stay unchanged, and deletion/import confirmation to remain available for retry. Start session and accept a pending PWA update when one is available; failed flush must prevent both transitions.
3. Restore writes using `Storage.prototype.setItem = window.originalRoutineSetItem` and `delete window.originalRoutineSetItem`. Retry the pending save/transition. Expect edited content to save and the requested transition to complete once. Reload to verify persistence.
4. To check failed migration/startup persistence, remove the collection key in a profile with valid legacy data, install the same write override, and remount the App without a full browser reload. Expect the initialization error, intact legacy bytes, and no default replacement. Restore writes and use Retry.

## Session source isolation

1. Create **Source routine** and **Other routine**, with distinct names, Tempo, Metronome sound, and Alternate beat tone. Start a Session from Source routine; retain the original stored record for comparison.
2. In developer tools, change the collection's `selectedRoutineId` to Other routine without deleting Source routine. In the active Session, save a changed Tempo, choose another Metronome sound, and change Alternate beat tone.
3. Inspect storage. Expect all three changes only in Source routine, unchanged Other routine, unchanged selected ID, and unchanged access timestamps. The captured Session plan must retain its original entries and settings despite saved choices.
4. Exit the Session and verify the editor follows the stored selection. Open Source routine and verify its saved settings.
5. Start another Session from Source routine, remove that source record through developer tools while keeping a valid Other routine selected, then attempt each setting save. Expect missing-source rejection and no changes to Other routine; there must be no fallback write to the selected Routine.
