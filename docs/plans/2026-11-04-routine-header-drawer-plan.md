# Routine header and drawer controls

Date: 2026-11-04
Status: Ready for implementation

## Scope and agreed outcome

Make the Routine title the name-editing control, replace the pencil with a hamburger opening the existing Routines drawer, and consolidate Routine management there. Immediately beneath the title, show the Duration pebble followed by the existing settings summary on the same line. Import and Export live below New routine in the drawer, using the dashed appearance of Add exercise/Add break with less height.

Non-goals: inline name editing, bulk export, new persistence or file formats, changes to Session behavior, changes to welcome-screen import, or redesigning settings controls.

## Current implementation and constraints

- `src/features/routine-editor/RoutineEditor/RoutineEditor.tsx` owns the heading, separate pencil, duration/import/export/picker row, settings composition, editor sheet, and hint anchor refs. `useRoutineEditor` owns persistence and mutations; preserve that ownership.
- `RoutinePicker/RoutinePicker.tsx` owns drawer visibility, selection, creation, recency ordering, and slide deletion. It uses the shared BottomSheet.
- `RoutineFileActions/RoutineFileActions.tsx` and `useRoutineFileActions.ts` own file selection, export, validation status, preview, and additive import confirmation. WelcomeScreen also uses these actions.
- `RoutineSettings/RoutineSettings.tsx` has a collapsed summary and animated inline expansion, focus restoration, and Metronome sound sheet. Preserve those behaviors and `summaryButtonRef` for hints.
- BottomSheet has a presence lifecycle and `onAfterClose`; avoid two simultaneously active modal sheets or competing focus traps.
- ADR 0009 governs additive import, fresh local identities, save-before-transition, and access ordering. Preserve it, existing file validation, limits, retries, and errors.
- At planning time, `src/styles.css` has an unrelated modification. Preserve it and recheck Git status before implementation.

## Acceptance criteria

1. The title remains an h1 and contains a native button activating existing routine-name editing by click, Enter, or Space. Save, Cancel, fallback name, and welcome-to-editor focus behavior remain intact. No separate pencil remains.
2. A current-color hamburger at the far right opens the existing Routines drawer. Accessible name is `Routines`, with dialog and expanded-state semantics. Closing restores focus to it. Long titles wrap without displacing it.
3. Immediately below the title, Duration appears before the existing settings summary on one row. Duration calculations, approximate marker, and accessible minute description are unchanged. On narrow screens, keep the pebble readable and use the existing summary truncation; no horizontal overflow. Expanded settings occupy the available width, and Duration remains visible.
4. Settings expansion, collapse, focus, sound selection, persistence, and empty-Routine hint positioning continue working after relocation.
5. Remove the old management row. Import and Export are available only inside the Routines drawer for an existing Routine. Preserve selection, New routine, deletion, capacity messaging, ordering, and collection refresh.
6. Import/Export appear below New routine, side by side, with the dashed border, transparent surface, rounding, and hover treatment of Add exercise/Add break. Use a compact 2.25rem minimum height and smaller vertical padding than those entry buttons; retain visible focus and disabled states. Labels remain Import and Export.
7. Export downloads only the selected Routine and leaves the drawer open, with visible status. Invalid Routines cannot export, with an explanation available inside the modal. Import is disabled at capacity with an in-drawer explanation.
8. Import preview replaces the drawer contents rather than stacking modals. Cancel returns to the Routines list. Successful import closes the drawer and shows the newly selected imported Routine. Read/validation errors remain visible in the list; save failure keeps preview and retry available. File-picker cancellation leaves the drawer usable.
9. Empty-collection welcome import and final-Routine deletion still work. No storage/schema migration or new dependency is required.

## Confirmed implementation decisions

Reuse RoutinePicker as the header trigger and drawer owner; do not build a second drawer. Keep the existing accessible trigger name so callers/tests can continue locating it. Add `MenuIcon` in `src/components/Icons/Icons.tsx`, using currentColor paths and the existing icon prop conventions; the barrel already exports icons.

Use a single BottomSheet in RoutinePicker, switching its title/content between Routines and Import Routine. Reuse `useRoutineFileActions` there and keep it mounted through the list/preview transition. Extract shared preview markup to a dedicated `RoutineFileActions/RoutineImportPreview.tsx` component used by RoutinePicker and RoutineFileActions; retain the existing wrapper for WelcomeScreen. Give the hook's successful confirmation a boolean result so the drawer closes only after successful saving. Cancel clears preview and returns to the list. Keep this change local to the feature; shared BottomSheet should not need behavioral changes.

Pass the selected Routine, validity, import callback, and disabled explanations from RoutineEditor to RoutinePicker. Render descriptions within the active dialog rather than pointing disabled controls only at background content. Keep storage decisions in useRoutineEditor. Track preview/list focus locally: focus the preview when it appears and the Import control when Cancel returns to the list, without reopening or stacking dialogs. Successful import closes the drawer and lets BottomSheet restore hamburger focus. Export status remains in the drawer.

Move RoutineSettings into the header area. Add an optional `durationSummary` ReactNode prop so its layout can place the existing pebble alongside the collapsed summary without duplicating settings state or the summary button. Lay out the expanded panel across the full row while retaining the Duration pebble. Keep the settings anchor attached to the actual summary button. Do not make the Duration pebble a name-editing control.

Record these UI ownership/presentation decisions in a new ADR during implementation and index it in `docs/adr.json`. Existing domain vocabulary and ADR 0009 remain authoritative.

## Ordered implementation phases

### 1. Header and settings composition

- Add MenuIcon in `src/components/Icons/Icons.tsx`.
- Update RoutineEditor.tsx and RoutineEditor.module.css: native title button inside h1; retain heading ID/ref; put RoutinePicker at the right; remove standalone file actions and obsolete submenu/pencil styles.
- Update RoutineSettings.tsx and RoutineSettings.module.css for the optional durationSummary slot and full-width expanded content. Preserve settings callbacks, refs, animated state, and sound sheet.
- Update RoutinePicker trigger styles to an icon button with an adequate target and visible focus.

Done when the requested two-row header works with short/long names and collapsed/expanded settings.

### 2. Drawer file workflow

Depends on phase 1 composition. Refactor RoutineFileActions/useRoutineFileActions and add RoutineImportPreview as described above. Wire new RoutinePicker props from RoutineEditor. Add compact dashed file controls and active-dialog errors/status. Keep hooks and components in dedicated feature files. Ensure final deletion and import do not retain stale preview state.

Done when list, preview, cancel, successful import, failed import, export, and ordinary Routine management satisfy criteria 5–9. This is bounded work; no delegation is needed.

### 3. Focused verification and decision documentation

Update `src/features/routine-editor/tests/RoutineEditor.test.tsx` and `RoutinePicker/RoutinePicker.test.tsx` to exercise the new entry points and modal content transitions. Existing tests accessing Import/Export directly must open Routines first. Preserve WelcomeScreen test paths. Cover title activation, accessible heading, management controls absent outside drawer, export status/disabled explanations, import cancel/success/failure, capacity restoration after deletion, and focus restoration. Add keyboard tests using real keyboard events or existing project test helpers.

Independently parallelizable after component interfaces settle: documentation/ADR drafting and manual layout verification; automated integration tests depend on phases 1–2. No large phase warrants an exploration agent.

Add the ADR and its index entry. Update `docs/files.json` only for new navigation targets if useful; the new preview component is already covered by the cohesive RoutineFileActions directory entry, and plans/reports/ADR are covered by directory entries. Do not add individual entries under those docs directories.

### 4. Final implementation report and manual guide

After verification, create:

- `docs/reports/2026-11-04-routine-header-drawer-report.md`: completed work, deviations, commands/results, manual evidence, remaining risks.
- `docs/reports/2026-11-04-routine-header-drawer-manual-test.md`: prerequisites, steps, expected results, and cleanup.

Done only when both files exist and accurately distinguish passed, failed, and unperformed checks.

## Verification mapped to acceptance criteria

Run these from the repository root during implementation:

- `pnpm exec vitest run src/features/routine-editor/tests/RoutineEditor.test.tsx src/features/routine-editor/RoutinePicker/RoutinePicker.test.tsx` — criteria 1–2 and 4–9, including existing persistence-failure regression cases.
- `pnpm test` — integration regressions, hint behavior, welcome flow, and unchanged Session/domain behavior.
- `pnpm lint`, `pnpm build`, `pnpm format:check` — static, build, and formatting gates. Report pre-existing unrelated failures separately; do not rewrite unrelated files to pass formatting.

Manual gate using `pnpm dev`: at 320px and ordinary mobile/desktop widths, verify long and fallback titles, pebble/summary alignment, summary truncation, expanded settings, hint arrows, hamburger focus, compact dashed controls, scroll with many Routines, modal focus containment, Escape/backdrop dismissal, reduced motion, and file-picker cancellation. Exercise valid, invalid, oversized, and unreadable files, cancelled preview, successful import, export download, storage failure, capacity, and final deletion. Export a backup before destructive tests; use disposable browser storage and clear it afterward without deleting real user data.

## Risks and factual checks

- Modal content switching can leave focus on removed elements. Test each list/preview transition and explicitly transfer focus after rendering; keep one modal owner.
- BottomSheet snapshots content during exit. Verify successful import and final deletion cannot leave interactive stale content during closure; use existing lifecycle mechanisms if needed.
- Layout changes can shift passive hints. Validate actual rendered anchors rather than hardcoding offsets.
- Recheck the worktree and relevant component interfaces before editing. If concurrent changes alter those interfaces, adapt the local composition while preserving the agreed behavior and note deviations in the report.
- No unresolved product decisions or migration is required.

## Binary completion gate

All nine acceptance criteria pass; required automated checks pass or unrelated failures are explicitly evidenced; manual gates have recorded outcomes; ADR/index and inventory rules are satisfied; both report artifacts exist; unrelated changes are preserved. Do not stage or commit without a separate request; any requested commit must use conventional commits.
