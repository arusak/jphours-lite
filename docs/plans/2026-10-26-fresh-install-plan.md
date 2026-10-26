# Fresh-install welcome and random routines

Date: 2026-10-26  
Status: Ready for implementation

## Scope and authorization

Show a welcome screen whenever the saved collection contains zero Routines, including first launch and successful deletion of the final Routine. Offer creation of a minimal Routine, creation of a random Routine, and import. The user approved writing this plan with “acceptable of course. go” after confirming the timing below.

Non-goals: allowing Routines with zero entries; automatic Session start; randomization of existing Routines; a random-generation action in the populated Routine picker; generation history or prevention of repeated selections across generations; new audio behavior, dependencies, cloud synchronization, or browser-tab coordination; changing existing total-duration rounding or portable Routine file formats.

## Acceptance criteria

1. **Welcome lifecycle:** With neither storage key present, initialize an empty collection and show the welcome screen without creating a Routine. Show the same screen after successfully deleting the final Routine, including after reload. A present empty collection remains authoritative over legacy storage. Preserve all existing saved Routines, even previously generated defaults.
2. **Welcome actions:** Display “Welcome! Make time for your practice.” with buttons “Create empty routine,” “Create random routine,” and a smaller “Import routine” action. Creation saves and selects the new Routine before opening its editor. Do not start a Session or activate audio. Keep PWA update acceptance available.
3. **Minimal creation:** “Create empty routine” creates one Exercise titled “Practice,” with Duration 300 seconds and Tempo 100 BPM. Keep the existing first-available naming convention: “New routine,” “New routine 2,” etc. Apply the same minimal content to the existing picker’s New routine action. A Routine still always has at least one entry; deleting its final entry retains the existing default-Exercise replacement behavior.
4. **Random content:** Name each random Routine using one randomly chosen adjective and one randomly chosen noun from the two fixed 30-word pools below, joined with a space (for example, “Smug Snare”). Include five distinct Exercise names selected from the fixed 30-name Exercise pool below. Generate on each click; never generate during render, reload, editor changes, or Session start. Repetition across generations is allowed, including identical names and selections. Saved random Routines remain ordinary editable, exportable, reloadable Routines.
5. **Random timing:** Randomly assign the Duration multiset 180, 180, 240, 300, 300 seconds. Independently assign a mixed ordering of Tempos 80, 90, 100, 110, 120 BPM. Include no Break entries; set Quick Rest Duration to 5 seconds. Exercise time totals 1,200 seconds; four Quick Rests add 20 seconds, making a Session of 20:20. Welcome helper copy states “20 minutes of exercises + 20 seconds of Quick Rest.” Preserve the editor’s current ceiling-to-minutes total (21 min).
6. **Import:** From welcome, retain the current file validation, preview, cancellation, and explicit Add routine confirmation. Successful import saves and opens the imported Routine with fresh local identities. Invalid, cancelled, stale, or failed imports leave the welcome screen and collection intact; no placeholder Routine is needed.
7. **Failure handling:** Failed creation or final deletion must not publish a successful transition. Keep errors visible and retryable; failed deletion retains the original Routine and confirmation. A successful final deletion cancels pending saves so advancing timers, unmounting, or accepting an update cannot recreate the deleted Routine. Corrupt or unsupported collections still block startup and preserve raw storage bytes.
8. **Compatibility:** Existing current and legacy Routines retain their identities, entries, settings, and migration behavior. Maintain the 100-Routine cap, additive import, recency ordering, selected-Routine fallback when other Routines remain, flush-before-transition behavior, and Session saves to the captured source ID. Welcome does not record Routine access; startup restoration of a selected Routine still records access once under StrictMode.

## Current implementation and constraints

- `src/services/persistence/routine-repository.ts`: `RoutineCollection` requires a string selection and at least one record. `loadCollection()` writes a default Routine when storage is absent; `remove()` creates a replacement after final deletion. Current collection data is authoritative over the legacy key. `load(id?)` returns a Routine and rejects missing IDs.
- `src/app/App.tsx`: startup calls `repository.select(repository.load().id)`, so an empty collection currently cannot reach the editor. Startup errors already have a Retry flow; Session settings load their captured Routine explicitly.
- `src/features/routine-editor/hooks/useRoutineEditor.ts`: initializes a mandatory Routine via `load()`, schedules debounced saves, flushes before collection mutations, and adopts the selected record using a non-null assertion. All these paths need deliberate empty-state handling.
- `RoutineEditor/RoutineEditor.tsx` reads a mandatory Routine throughout. `RoutinePicker/RoutinePicker.tsx` owns deletion confirmation and focus restoration. Final deletion must unmount the picker cleanly and move focus to the welcome heading.
- `RoutineFileActions/useRoutineFileActions.ts` combines import with export and currently requires a Routine only for export. Reuse its existing validation/preview workflow without manufacturing a dummy Routine.
- `src/domain/routine.ts` factories use config defaults (Exercise: 300 seconds, 80 BPM; Quick Rest: 30 seconds). Apply feature-specific creation overrides instead of changing global Exercise or Quick Rest defaults.
- `src/domain/routine-schema.ts` requires at least one entry. Preserve that invariant. `routineTotal.ts` includes Quick Rest and uses `Math.ceil(seconds / 60)`.
- ADR 0009 currently mandates a replacement after final Routine deletion. Supersede that clause in an implementation ADR. Canonical terminology lives in `docs/UBIQUITOUS_LANGUAGE.md`.

## Confirmed implementation decisions

### Storage and lifecycle ownership

Keep the existing collection key and storageVersion 1. Extend `selectedRoutineId` to `string | null`; allow 0–100 records. Canonical empty storage is `{ storageVersion: 1, selectedRoutineId: null, routines: [] }`. Require null selection for an empty collection; reject an empty array with a stale string selection as inconsistent data. For nonempty collections, repair null or missing selected IDs using the existing recency rule. Existing valid nonempty version-1 data remains readable without rewriting content. Older application builds cannot read the new empty state; deployment must distribute the updated app together, and rolling back to an older build after emptying storage is unsupported.

When both keys are absent, persist the canonical empty collection. Preserve existing legacy parsing/migration and invalid-legacy fallback when a legacy key exists; this feature does not redesign corrupt legacy recovery. Never revisit legacy storage after a collection key has been written, including an empty collection. On final deletion persist the canonical empty state atomically. Keep `load(id?): Routine` and missing-ID errors: it throws if no selected Routine exists. Startup and welcome must use `loadCollection()` instead.

The editor hook owns current collection state and nullable selected Routine. Initialize from one collection read; adopt either its selected Routine or null. Do not create a transient in-memory Routine to satisfy old assumptions. App startup reads the collection and records access only if a selection exists, then mounts the editor for either state. No additional App-level welcome state or onboarding-completed flag is needed.

Guard selected-Routine actions and validation when null. Keep hooks unconditional, schedule saves only for real selected Routines, and cancel the saver when adopting an empty collection. After flushing edits, mutate storage, then adopt the committed result. Guard every nullable access rather than adding non-null assertions that hide empty-state bugs. Keep existing IDs mandatory for save/select/remove operations.

### Creation and randomization

Add a feature-owned `routine-creation.ts` with `createBlankRoutine(name)` and `createRandomRoutine()` using `createRoutine`/`createExercise` for fresh UUIDs and timestamps. Keep unrelated creation defaults unchanged. Blank creation uses the established normalized exact-name gap algorithm from `createNewRoutine`. For random creation, independently pick one adjective and one noun with `Math.floor(Math.random() * pool.length)` and join them as `Adjective Noun`. Duplicate names remain allowed; do not append numbers or retry collisions. Other settings inherit existing factory defaults; only random Quick Rest is overridden to 5 seconds.

Keep both word pools as readonly arrays in the same module. Use the exact title-cased words below: at most eight letters per word, dry, slightly self-assured or humorous, with musical nouns. The 30 × 30 pools provide 900 possible names, such as “Bitter Brass,” “Blunt Groove,” “Crooked Backbeat,” “Stubborn Cowbell,” “Reckless Rimshot,” and “Dead Beat.” Pick words independently of Exercise selection, Duration, and Tempo. Persist the generated name as ordinary editable Routine content; never regenerate it on reload.

| #   | Adjective | Noun     |
| --- | --------- | -------- |
| 1   | Bitter    | Beat     |
| 2   | Blunt     | Bass     |
| 3   | Bold      | Brass    |
| 4   | Brisk     | Click    |
| 5   | Cold      | Clave    |
| 6   | Crooked   | Clap     |
| 7   | Crisp     | Crash    |
| 8   | Dark      | Drum     |
| 9   | Dead      | Fill     |
| 10  | Dry       | Funk     |
| 11  | Stubborn  | Gong     |
| 12  | Flat      | Groove   |
| 13  | Reckless  | Shuffle  |
| 14  | Lean      | Rimshot  |
| 15  | Loose     | Horn     |
| 16  | Loud      | Jam      |
| 17  | Lopsided  | Jazz     |
| 18  | Mean      | Kick     |
| 19  | Odd       | Loop     |
| 20  | Restless  | Backbeat |
| 21  | Proud     | Note     |
| 22  | Raw       | Pulse    |
| 23  | Rough     | Offbeat  |
| 24  | Sharp     | Rest     |
| 25  | Slick     | Riff     |
| 26  | Sly       | Roll     |
| 27  | Smug      | Snare    |
| 28  | Stiff     | Stomp    |
| 29  | Tight     | Swing    |
| 30  | Wry       | Cowbell  |

Store the following names as a readonly array in this module. These are titles; the app does not generate scores, change metronome accent patterns, or implement the named musical techniques automatically.

| 1–10               | 11–20                 | 21–30            |
| ------------------ | --------------------- | ---------------- |
| Offbeat Lock       | Dotted Pulse          | Downbeat Drop    |
| Three Against Two  | Swing Switch          | Accent Pyramid   |
| Accent Carousel    | Beat Displacement     | Rhythm Mirror    |
| Subdivision Switch | Three-Note Loop       | Unison Break     |
| Missing Downbeat   | Five-Note Loop        | Double-Time Feel |
| Backbeat Snap      | Syncopation Ladder    | Half-Time Pocket |
| Triplet Weave      | Offbeat Triplets      | Triplet Accents  |
| Sixteenth Sprint   | Quarter-Note Triplets | Sixteenth Gaps   |
| Ghost Notes        | Sixteenth Shuffle     | Two-Bar Echo     |
| Accent Flip        | Rest Rotation         | Rhythm Inversion |

Use Fisher–Yates on copies: shuffle the pool and take five; separately shuffle the Duration and Tempo arrays. If the Tempo result is strictly ascending or descending, swap its second and third entries to guarantee mixed order with bounded work. Ordinary `Math.random` is sufficient. Do not use random sort comparators, mutate the pool, add persisted generation metadata, or retry until a previous selection differs. Deterministically stub randomness in focused tests; do not assert that separate real random calls must differ.

### UI and import reuse

Add `WelcomeScreen/WelcomeScreen.tsx` and its CSS module under `src/features/routine-editor/`. It receives creation/import callbacks and error state, uses existing shell styling and accessible native buttons, and does not own persistence. Give it a focusable heading; focus it after final deletion and focus the editor heading after welcome creation/import, without stealing focus on ordinary editor changes.

In `RoutineEditor`, keep `AppUpdateBanner` available in both branches with the existing flush callback. Render welcome when the hook's Routine is null; render existing settings, entries, picker, sheets, export, and Start session only with a selected Routine. No Routines drawer is needed on welcome.

Make the existing file action component and hook accept an optional Routine. Render Export only when one exists and guard the export handler. Add an optional import-button label with current “Import” as default; welcome supplies “Import routine.” Reuse the same input, preview, strict parser, fresh-identity behavior, and Add routine confirmation. On a failed import with no selected Routine, use accurate wording such as “The Routine could not be saved. Check browser storage and retry Add routine”; do not claim a current Routine was kept. Preserve the existing populated-editor failure wording. Creation errors remain visible on welcome and allow retry through the same action without creating duplicates after a successful write.

## Implementation phases

### Phase 1 — Storage support and creation factories

**1A: Repository lifecycle.** Update `RoutineCollection`, `collectionIngressSchema`, `parseCollection`, `loadCollection`, `remove`, and the empty case in `load` in `src/services/persistence/routine-repository.ts`. Preserve mutation atomicity, migration, limits, recency rules, and corrupt-byte protection. Update `routine-repository.test.ts`: first initialization, canonical empty reload, final deletion, empty authority over a legacy backup, add into empty, inconsistent selection, failed final deletion/creation, and all existing compatibility cases.

**1B: Creation.** Add `src/features/routine-editor/routine-creation.ts` and `tests/routine-creation.test.ts` implementing the exact factories/pools/algorithm above. Test 30 unique valid Exercise names, five distinct selections, Duration multiset/sum, Tempo multiset and mixed order, fresh identities, valid Routine schema, 5-second Quick Rest, and no Breaks. For Routine names, assert exactly 30 unique adjectives and 30 unique nouns, at most eight letters per word, independently selected words in `Adjective Noun` format, first/last index boundaries under stubbed randomness, and valid Routine name length. Repeated names must remain permitted. Test both monotonic Tempo correction branches and that source arrays remain intact. Blank tests assert Practice/300/100.

**Independent work:** 1A and 1B can run in parallel because they share only existing domain factories. This is a small feature; no delegated large phase is required.

### Phase 2 — Empty-state UI and transitions

Depends on Phase 1.

**2A: Startup and hook.** Update `src/app/App.tsx` startup and `App.test.tsx` mocks to use `loadCollection()` and skip selection for empty collections. Preserve StrictMode access and startup retry coverage. Update `hooks/useRoutineEditor.ts` to own a nullable Routine, guard operations, cancel saves on empty adoption, expose blank/random creation callbacks, and support import without a selected Routine. Continue flushing before deletion or any collection transition.

**2B: Import and welcome composition.** Update `RoutineFileActions/RoutineFileActions.tsx` and `useRoutineFileActions.ts` as above; add `WelcomeScreen/` component/styles. Update `RoutineEditor/RoutineEditor.tsx` and styles as needed. Keep hooks/components in dedicated feature files and any new reusable icons in `src/components/Icons/Icons.tsx` with currentColor paths; prefer existing icons. Update picker behavior only where final-deletion focus/unmount requires it; keep confirmations for failed writes.

**2C: Focused integration coverage.** Extend `tests/RoutineEditor.test.tsx`, `src/app/App.test.tsx`, and picker coverage where needed. Update in-memory repository doubles to model nullable selection and final deletion honestly. Remove fixture assumptions that fresh storage already contains a default Routine; replace accidental count expectations with counts of explicitly added fixtures. Existing capacity tests must explicitly seed 100 Routines. Replace tests expecting the drawer to remain after final deletion with welcome assertions, while retaining drawer behavior when other Routines remain.

Cover creation failures/retries, reload persistence, repeated random creation via deleting the final Routine, no rerandomization of saved content, valid/invalid/cancelled/failed import, focus transitions, no audio activation, and accepting updates with empty state. Use fake timers to prove no delayed save resurrects a deleted Routine. Prefer at least one App integration path with real local-storage repository semantics rather than only mocked screen components.

### Phase 3 — Documentation, verification, and implementation handoff

Depends on Phases 1–2.

1. Add `docs/adr/0010-empty-collection-and-random-routines.md` and index it in `docs/adr.json`; explain empty collections versus nonempty Routines, collection compatibility, ordinary random generation, exact timing, and supersession of ADR 0009's final-deletion clause. Update that clause with a link to the new ADR so it no longer reads as current policy. Update `docs/UBIQUITOUS_LANGUAGE.md` relationships for zero saved Routines and the welcome flow, preserving nonempty Routine terminology.
2. Update `docs/files.json` for `WelcomeScreen/` and `routine-creation.ts` if useful as a standalone target. Keep immediate `docs/` subdirectories represented by their existing directory entries. No generated code, dependency, runtime config, or portable schema changes are required.
3. Run the automated gates below and perform manual checks. Fix failures attributable to this feature; document unrelated failures precisely.
4. Write `docs/reports/2026-10-26-fresh-install-report.md` with completed work, deviations, commands/results, and remaining risks. Write a separate `docs/reports/2026-10-26-fresh-install-manual-test.md` with prerequisites, exact steps/expected results, and cleanup/restoration of test data. These artifacts are required for implementation completion, not outputs of this planning workflow.

## Verification mapped to acceptance criteria

Run from the repository root with the installed pnpm toolchain:

```sh
pnpm exec vitest run src/services/persistence/routine-repository.test.ts src/features/routine-editor/tests/routine-creation.test.ts
pnpm exec vitest run src/app/App.test.tsx src/features/routine-editor/tests/RoutineEditor.test.tsx src/features/routine-editor/RoutinePicker/RoutinePicker.test.tsx src/features/routine-editor/tests/routineTotal.test.ts src/services/persistence/debounced-routine-saver.test.ts src/services/routine-files/routine-file.test.ts
pnpm test
pnpm run build
pnpm run lint
pnpm run format:check
```

- First command: criteria 1, 3–5, 7–8 at repository/factory boundaries.
- Second command: criteria 1–8 at startup/editor/import boundaries; add a regression that a generated Routine's `routineTotal` remains `{ minutes: 21, approximate: false }`. Do not change total rounding to hide Quick Rest.
- Full test/build/lint/format gates: nullable-selection callers, fixtures, type safety, and existing behavior. Format only changed files if formatting is necessary; avoid unrelated churn. If the global format check fails on preexisting files, record the failure and check touched files separately.

Manual gate using `pnpm dev` in an isolated browser profile:

1. With both app storage keys absent, verify welcome, keyboard focus, narrow/mobile layout, both creation actions, reload behavior, and no Session/audio until Start session. Inspect the blank Exercise's exact fields.
2. Create random Routines in several create/delete cycles; inspect the two-word Routine name against the adjective/noun pools, five unique Exercise names, mixed Tempos, varied Durations totaling 20 minutes, Quick Rest 5 seconds, no Breaks, and the editor's 21 min summary. Equal names and selections across runs are allowed. Rename and reload a generated Routine to confirm its edited name persists.
3. Start a generated Session and verify a 5-second Quick Rest between adjacent Exercises, none after the last, correct Tempo for each Exercise, and normal editing/export/reload behavior. The full 20:20 run may be verified with controlled Session time in automated tests; manual observation need only confirm transition behavior.
4. Delete the final Routine through the existing slider; verify drawer dismissal, focus on welcome, reload persistence, and no delayed resurrection. Delete a selected Routine while another remains and verify the existing recency fallback.
5. Import a valid file from welcome, cancel a preview, select invalid data, and simulate storage write failures. Confirm no placeholders or lost original data. Confirm PWA update acceptance remains available in the empty state when an update is available.
6. Seed a valid existing collection and a legacy-only Routine in separate isolated cases. Verify preserved content and migration; then empty the current collection while a legacy backup exists and confirm it stays empty after reload. Corrupt current storage must show Retry without overwriting its bytes.

Prerequisites and cleanup: use isolated test data or back up both storage keys before mutation. Restore original key values or remove test-only keys afterward; close Sessions and restore any mocked storage/time behavior. PWA update checks require two controlled local builds with service-worker support, not just the Vite development server.

## Risks and factual resolution steps

- **Nullable selection propagation:** compiler errors and repository doubles may reveal additional callers. Run the build after Phase 2A; update every actual caller to distinguish no selection from missing-ID failure. Never widen Routine itself to nullable in the Session player.
- **Save resurrection or partial transitions:** existing debounced saves and drawer focus lifecycles are the main integration risks. Resolve with failed-write and timer-advance tests; if a transition publishes early, move adoption after the persisted result and cancel stale saves before rendering welcome.
- **Display precision:** 20:20 intentionally appears as 21 min under existing rounding. The welcome helper copy gives exact composition; a more precise global total display is outside scope.
- **Storage rollback:** older builds reject canonical empty collections. The new parser must read all existing valid nonempty collections; no old-build rollback compatibility is promised for newly written empty state. Record this in the ADR/report.
- **PWA test availability:** inspect existing registration/update helpers during implementation. If an update cannot be staged locally, retain automated coverage of the empty-state banner/flush path and explicitly mark the two-build manual update gate as pending in the report; do not claim it passed.
- There are no unresolved product decisions. Any newly discovered implementation limitation must be resolved within these contracts or documented as a deviation requiring agreement if it changes visible behavior.

## Binary completion criteria

Implementation is complete when all eight acceptance criteria hold, focused and full automated gates pass (or unrelated failures are identified), the manual guide records actual gate results including any pending PWA environment gate, ADR/language/inventory updates are present, and both report artifacts exist. A known functional failure or an unverified core welcome/create/import/delete flow prevents completion. No implementation, test execution, inventory edit, or ADR creation is authorized as part of this plan-writing step itself.
