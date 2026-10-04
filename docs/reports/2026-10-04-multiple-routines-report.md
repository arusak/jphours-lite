# Multiple local Routines implementation report

Date: 2026-10-04
Plan: [Multiple local Routines](../plans/2026-10-04-multiple-routines-plan.md)

## 1. What was the task?

Implement local storage for up to 100 Routines, an accessible Routine picker with creation and slide-confirmed deletion, additive import, restoration of the selected Routine, and Session settings saved only to their source Routine.

## 2. What was your analysis?

The existing repository and debounced editor saver were the ownership boundaries. Collection metadata belongs in a separate storage envelope, leaving Routine content and portable files unchanged. Every transition must flush edits before committing its collection mutation, and failed writes must retain the current editor and confirmation state. ID-aware saves prevent deleted Routines from being reinserted. Session saves must address the captured Routine ID.

The implementation reused BottomSheet, name normalization, Routine totals, validation, and the existing slide control. Final review identified and corrected a fallible read after committing selection, keyboard focus loss during deletion confirmation, and pointer taps that could confirm without sliding. Regression coverage exercises transition failures, stale import previews at capacity, delayed saves after switching/deletion, migration, malformed storage, and all three Session save callbacks.

## 3. What changes were made?

- Added validated collection persistence, stable access ordering, selected-ID recovery, migration backup preservation, atomic mutations, and the 100-Routine limit.
- Added background-save error reporting and retry while retaining pending edits.
- Added the Routine picker, immediate default creation with available numbered names, selection, and slide-confirmed deletion.
- Extracted the shared SlideToConfirm component and retained Session wording and configured threshold. Pointer confirmation occurs on release so cancelled gestures cannot delete.
- Made import additive with retained previews on failure, disabled Import at capacity, and preserved the portable export format.
- Added startup error/retry handling and Routine-ID-specific Session settings saves.
- Recorded ADR 0009, linked the superseded import decision, updated vocabulary and inventory, and added a separate manual test guide.

### Existing check issue

Lint still reports the pre-existing unused `index` parameter in `RoutineEntryCard.tsx:20`; this line was already present in HEAD. It does not fail the lint command.

### Deviations and remaining verification

Manual browser verification is blocked: this session exposes no browser execution/control tool. The Browser skill was read and available tool metadata checked; no runnable browser surface was available. Automated DOM checks do not establish touch behavior, real focus trapping, 320 px rendering, offline/reload operation, or cross-profile file transfer. Follow [the manual test guide](2026-10-04-multiple-routines-manual-test.md) before marking the manual gate complete.

The count limit does not guarantee enough browser storage for 100 large Routines. Storage errors remain retryable. Concurrent browser-tab editing and cloud synchronization remain outside the approved scope.
