# Multiple local Routines

Date: 2026-10-04  
Status: Ready for implementation

## Scope and approval

Add a Routine picker beside Import and Export, local persistence for up to 100 Routines, immediate creation, deletion by slide confirmation, ordering by last access, and restoration of the last opened Routine. The user approved writing this plan with “+” after the scope summary, including the 100-Routine limit.

Non-goals: cloud connectivity, accounts, sync/conflict protocols, duplication, bulk transfer, searching, manual ordering, Session restoration, and coordinated editing across browser tabs. Keep existing UUID identities for future sync; introduce no cloud repository or speculative sync fields.

## Acceptance criteria

1. A **Routines** button beside Import and Export opens the existing accessible bottom-sheet dialog pattern. Rows display name, calculated duration (including approximate totals), and a selected indicator. Clicking a row saves pending edits, opens that Routine, and closes the drawer. Clicking the selected row simply closes the drawer.
2. **New routine** immediately creates and opens a Routine with one default Exercise and the existing default settings; there is no name prompt. Use `New routine` if available, otherwise the first available `New routine N`, starting at 2. Compare exact normalized names; gaps may be reused. Existing rename behavior remains available and duplicate names are otherwise allowed.
3. Order by descending last-access timestamp, preserving stored array order for ties. Update last access on explicit opening, creation, confirmed import, and startup restoration. Do not change it for edits, exports, Session saves, drawer opening, or returning from a Session. Opening an already selected row is not a new access.
4. Startup restores the selected Routine. If its stored ID is missing, select the most recently accessed Routine. Fresh installs have one default Routine. Existing valid single-Routine data migrates without losing entries, settings, order, or valid IDs.
5. A row's delete icon replaces that row with **Slide to delete** and **Cancel**. Only one row can be in this state. Cancel or drawer dismissal abandons deletion. Crossing the existing slide threshold confirms deletion with no second dialog. Pointer and keyboard operation are supported, and incomplete/cancelled gestures do not delete.
6. Deleting a nonselected Routine keeps the selection. Deleting the selected Routine opens the most recently accessed remaining Routine and records that access. Deleting the last creates and selects a default `Practice routine` with one default Exercise. Deletion stays in the drawer, restoring its normal rows after success.
7. At 100 Routines, disable New routine and Import, with visible and accessible explanation: `You can save up to 100 routines. Delete a routine to add another.` Existing Routines remain editable, openable, exportable, and deletable. Repository insertion enforces the same cap, including an import whose preview was opened before the cap was reached. Deletion immediately restores creation/import availability.
8. Import retains validation, preview, cancellation, file-size restrictions, and fresh local identities, but its confirmation becomes **Add routine**. Successful import adds and opens a Routine without replacing another. Export transfers only the selected Routine using the unchanged portable file format.
9. Save pending edits before switching, creation, import confirmation, or deletion. If saving or the collection mutation fails, retain the current editor, collection selection, and deletion/import confirmation state, and show an actionable error. Retain pending edits for retry. No delayed save can resurrect a deleted Routine or select a previously opened Routine.
10. Start session and PWA-update acceptance still flush pending edits. Session plans remain captured and immutable. Saved Tempo, Metronome sound, and Alternate beat tone changes update only the Routine that started that Session, without changing access ordering.

## Current state

- `src/domain/routine.ts` defines schema version 2, UUID identities, `updatedAt`, `createRoutine`, and `createExercise`. `src/domain/routine-schema.ts` and `name-normalization.ts` provide validation and name normalization. Routine content does not need a schema-version bump for collection metadata.
- `src/services/persistence/routine-repository.ts` exposes `RoutineRepository.load()/save()`, one key (`rhythm-practice-trainer/routine`), and tolerant version 1/2 migration through `migrateRoutine`. Invalid legacy data currently falls back to a default Routine.
- `useRoutineEditor` owns the selected editable Routine and schedules `DebouncedRoutineSaver` after changes with a 300 ms delay. `replaceRoutine` currently saves an import before cancelling pending edits. Additive import must instead preserve those edits by flushing them first.
- `RoutineEditor` renders the submenu, delegates file actions, and flushes before starting a Session or accepting an update. `RoutineFileActions` previews before replacement; the file codec deliberately excludes local identity and timestamps.
- `src/app/App.tsx` owns the repository and captured active Session Routine. Its three Session save callbacks currently use unqualified `repository.load()`; they must load by `activeRoutine.id`.
- `BottomSheet` already supplies focus management, Escape/backdrop dismissal, reduced-motion behavior, and animated presence. `StopSlider` already supplies pointer/keyboard slide confirmation; share this implementation for the second real use.
- Related decisions: `docs/adr/0005-routine-storage-and-file-compatibility.md` and `0006-controlled-pwa-updates.md`. Preserve `docs/UBIQUITOUS_LANGUAGE.md` terminology.

## Confirmed implementation decisions

### Persistence ownership and interface

Keep collection storage in the existing persistence module. Add a separate key, `rhythm-practice-trainer/routines`, holding:

```ts
interface RoutineCollection {
  storageVersion: 1;
  selectedRoutineId: string;
  routines: { routine: Routine; lastAccessedAt: string }[];
}
```

Export `ROUTINE_MAX_COUNT = 100` here. Store array order as the stable tie-breaker; sort copies for display. Access metadata must not be written into Routine content, alter `updatedAt`, or enter file serialization.

Extend the existing repository contract with `loadCollection()`, `select(id)`, `add(routine)`, and `remove(id)`. Retain `load(id?)` (no argument reads selected; explicit missing IDs throw) and `save(routine)` for existing Routine edits. `save` updates by ID without changing selection/access metadata and rejects missing IDs; it never inserts. `select` updates selection/access atomically and returns the selected Routine; `add` and `remove` return the resulting collection. All mutations write the complete candidate envelope with one `setItem` before publishing success. Read current collection data before mutations so a stale cached copy is not blindly rewritten. Cross-tab conflict resolution remains out of scope.

Initialize and persist a default/migrated collection when the new key is absent. Reuse supported Routine migration, validate unique Routine IDs, valid access timestamps, and the 1–100 invariant. For migration, use the startup time as initial access. Keep the old key untouched as a migration backup; once the new key exists, it is authoritative. Failed writes must not switch in-memory state or mark migration successful.

For existing collection data, distinguish unsupported/corrupt collection data from absent data. Never truncate a collection over 100 or silently replace a malformed collection with a default. Preserve its raw bytes and show a storage error that blocks mutation; provide retry after the underlying data/storage problem is corrected. Apply supported migration to individual Routine records, but reject unrecoverable collection records rather than silently substituting defaults. Refactor the migration parser internally to expose parse failure while retaining the existing public legacy `migrateRoutine` fallback contract and tests. A missing selected ID is repairable through most-recent-access fallback.

Mark startup restoration as an access in App's repository initialization, before the editor first loads. Ordinary `load` and editor remounts do not record access. Handle initialization failure through a visible App error/retry state. Collection operations retain their last successful UI state on failure; background save failures retain pending edits and expose retry through the editor. Use synchronous local-storage errors; do not add async storage scaffolding.

### Editor lifecycle

Keep the active Routine and collection summary state in `useRoutineEditor`; repository state is authoritative after successful writes. Reload summaries after successful mutations and when opening the drawer, overlaying the current editor Routine for up-to-date names/totals. Derive limit availability from the collection count.

Introduce editor operations for selecting, creating, importing, and deleting. Each flushes pending edits first, performs the repository mutation, then adopts the resulting selected Routine and summaries only on success. Cancel old pending saves only after successful mutation. Reuse the current persisted-replacement marker to avoid an unnecessary follow-up save after adopting a persisted Routine. Retain the existing save-before-state-change safety property.

Use a dedicated `RoutinePicker` component and CSS in the Routine Editor feature, keeping UI state (open drawer, pending deletion row) there. Keep repository mutations and their failures in the feature hook. Each row has a normal select button and separate, specifically named delete button. Use real disabled buttons and `aria-describedby` for cap explanations. Reset confirmation state on drawer dismissal; do not stack a second dialog over the drawer.

Extract `StopSlider` into shared `src/components/SlideToConfirm/` with label, accessible name, icon, threshold, and confirmation callback props. Update its two Session call sites to preserve existing behavior, wording, and configured threshold; pass a delete icon and Routine-specific accessible name from the picker. Remove the old StopSlider module after migrating its callers. Put any new icon in `src/components/Icons/Icons.tsx`, using `currentColor`. No new dependency is needed.

## Implementation phases

### 1. Collection persistence and migration

1. Extend `routine-repository.ts` with the collection type, limit, envelope validation, loss-preserving initialization, and ID-aware repository operations described above. Keep portable schemas untouched.
2. Update `routine-repository.test.ts` with collection round-trip, legacy migration, selected-ID fallback, ordering/access rules, duplicate IDs, cap rejection, malformed/unsupported data preservation, missing-ID writes, and failed-write invariants.
3. Adjust `DebouncedRoutineSaver` in `debounced-routine-saver.ts` only as needed to report failures and retry pending edits. Keep pending data after failed writes. Narrow its repository dependency to `Pick<RoutineRepository, 'save'>` so the existing saver check does not require a fabricated collection interface. Add focused fake-timer coverage for retry and cancellation after successful transitions.

### 2. Shared slide control and Routine picker

Dependency: the collection contract from phase 1 is fixed. **Independent work:** the shared slide extraction and presentational picker can proceed in parallel with phase 1 implementation; their integration depends on phase 3. These are small bounded changes; delegation is optional, not required.

1. Extract the existing slide control to `src/components/SlideToConfirm/`, export through `src/components/index.ts`, update both `SessionPlayer.tsx` call sites, and migrate `sessionPlayerParts.test.tsx` coverage to the shared control's focused test file. Preserve Session slider behavior and accessibility.
2. Add `src/features/routine-editor/RoutinePicker/RoutinePicker.tsx`, its CSS module, and focused UI tests. Use `BottomSheet`, Routine totals, selection/delete controls, single-row confirmation, Cancel, count-limit explanation, and error display. Provide callback props rather than embedding storage access.
3. Add any required icon through the shared Icons module. Check narrow mobile widths and long names.

### 3. Editor, import, and Session integration

Dependencies: phases 1 and 2.

1. Extend `hooks/useRoutineEditor.ts` with collection summaries and transition operations. Generate numbered names from existing normalized names using a bounded scan (at most 100 records). Preserve defaults, current validation, autosave, and PWA flush semantics.
2. Wire the picker and Routines trigger in `RoutineEditor/RoutineEditor.tsx` and `RoutineEditor.module.css`; update `types.ts` where necessary. Creation/selection close the drawer; deletion leaves it open. Keep rename and entry editing behavior intact.
3. Update `RoutineFileActions.tsx` and `useRoutineFileActions.ts` to accept the collection-limit disabled state and explanation, confirm additive import, and accurately report save/limit failure while retaining preview. Keep cancellation and stale file-read protection. Rename `replaceRoutine` to an additive import operation; remove replacement wording.
4. Update `App.tsx` to record startup access and save Session changes through `load(activeRoutine.id)`. Preserve audio activation order, controller disposal, and editor remount behavior. Update the App repository mock and add tests exercising all three Session save callbacks against two stored Routines.
5. Extend `RoutineEditor.test.tsx` with creation, numbering gaps, opening/restoration, limits, sorting, selected/nonselected/last deletion, additive import, and failure behavior. Update existing replacement tests to additive expectations. Verify that advancing the debounce timer after switching/deleting cannot overwrite selection or resurrect data.

### 4. Documentation, verification, and handoff

Dependencies: all implementation phases.

1. Record collection ownership, last-access semantics, cap, and additive import in a new ADR under `docs/adr/` and update `docs/adr.json`. Update ADR 0005's superseded replacement description to link the new decision. Update vocabulary relationships only where multiple Routine ownership needs clarification.
2. Update `docs/files.json` for the picker/shared slider directory additions and StopSlider removal. Use cohesive directory entries. Existing `docs/plans/`, `docs/adr/`, and `docs/reports/` entries already cover their contents; do not add individual document entries.
3. Run the automated gates below and perform manual drawer/storage checks. Fix failures caused by this change before reporting completion.
4. Write `docs/reports/2026-10-04-multiple-routines-report.md` with completed work, deviations, verification results, and remaining risks.
5. Write a separate `docs/reports/2026-10-04-multiple-routines-manual-test.md` with prerequisites, steps, expected results, and test-data cleanup. Include legacy migration, full capacity, narrow screens, pointer/keyboard deletion, reload restoration, save failure, and Session settings isolation.

## Verification mapping

Focused automated command after implementation (including planned new tests):

```sh
pnpm exec vitest run src/services/persistence/routine-repository.test.ts src/services/persistence/debounced-routine-saver.test.ts src/components/SlideToConfirm/SlideToConfirm.test.tsx src/features/routine-editor/RoutinePicker/RoutinePicker.test.tsx src/features/routine-editor/tests/RoutineEditor.test.tsx src/app/App.test.tsx src/services/routine-files/routine-file.test.ts src/features/session-player/tests/sessionPlayerParts.test.tsx src/features/session-player/tests/SessionPlayer.test.tsx
```

- Criteria 1–3, 5–7: picker/editor and slider tests, covering keyboard operation, Cancel, threshold, numbering, recency, and 99 → 100 → 99 transitions.
- Criteria 4, 7, 9: repository and saver tests, with throwing Storage fakes, legacy/current payloads, and fake timers. Verify failed creation/deletion/selection does not change stored bytes or published state; failed legacy initialization leaves the original key intact.
- Criterion 8: file/editor tests, retaining strict validation, byte limit, fresh identities, cancellation, and unmodified portable format; test cap recheck at import confirmation.
- Criteria 9–10: editor/App/Session tests, including failed flush, delayed saves, missing Session source ID (no fallback to another Routine), all three setting callbacks, immutable captured Session behavior, and PWA save-before-update integration.

Required final automated gates:

```sh
pnpm test
pnpm build
pnpm lint
pnpm format:check
```

Manual gate: run `pnpm dev` in a disposable browser profile. Exercise drawer focus restoration, Escape/backdrop dismissal, touch/pointer sliding without accidental row selection, long names at 320 px width, recency after reload, offline persistence, migration from the old key, the 100-Routine explanation, and deletion down to the default Routine. Confirm exported JSON contains no collection/access metadata and imports into a separate fresh profile. Exercise a mocked failing write and successful retry, then verify a Session's saved settings affect only its source Routine. Preserve any original browser storage before testing and restore it afterward; remove only the disposable test keys/profile.

## Risks and factual checks

- Local storage can exhaust quota before 100 large Routines. The cap is a count limit, not a capacity guarantee; failed writes keep edits and selection intact and report retryable failure. Do not claim a successful save before `setItem` succeeds.
- Lifecycle ordering can allow an old timer to save after deletion. Resolve through ID-aware save rejection, flush-before-transition, and the fake-timer regression checks in phase 3.
- Corrupt collections must not be silently overwritten during a mount effect. Check initialization and blocked-mutation paths with unchanged raw-byte assertions; if invalid data can reach autosave, fix that gate before completion.
- No unresolved product decisions remain. At implementation, verify that moving the slider has not left imports behind with `rg -n 'StopSlider' src docs/files.json`; migrate any remaining code caller and inventory entry before removing the old module.
- No cloud or multi-tab consistency guarantee is introduced. Each mutation rereads storage, but simultaneous edits in different tabs can still conflict. Revisit coordination only when that workflow or cloud sync is requested.

## Binary completion criteria

Complete only when all ten acceptance criteria hold, focused and final automated gates pass, manual verification passes (or is explicitly reported as blocked rather than claimed complete), ADR/index/inventory changes are accurate, and both implementation report and manual guide exist. This planning workflow changes only this approved plan file; code, tests, dependencies, configuration, and other documentation remain untouched until implementation is requested.
