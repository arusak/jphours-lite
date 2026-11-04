# Empty Routine hints

Date: 2026-11-04
Status: Ready for implementation

## Scope and agreed behavior

Show three labelled, hand-drawn arrows in the Routine editor when its saved Routine entries match the empty Routine template. The arrows identify Add exercise, the Routine settings disclosure, and the Exercise edit button. Use the user's supplied screenshot as a visual reference for thin light curves, with better spacing and smaller, neater arrowheads.

Non-goals: a first-run tour, dismissal controls, persistent onboarding metadata, changes to Routine defaults, storage migrations, or changes to Session behavior.

## Acceptance criteria

1. A Routine qualifies exactly when it has one entry, that entry is an Exercise, and its title, Tempo, and Duration equal the blank creation template: Practice, 100 BPM, 300 seconds. Compare the complete content excluding generated entry identity; reject extra entries, Breaks, and null or different values. A shared constant supplies both creation and comparison.
2. Routine name, settings, IDs, and timestamps do not affect eligibility. This clarifies the original “changes anything” wording: only Routine-entry content controls visibility.
3. Eligible Routines show “Add an exercise”, “Adjust routine settings”, and “Edit this exercise”. Each arrow points at its actual control, with compact arrowheads and readable labels clear of controls and one another. No animation is required.
4. Saving a differing Exercise or adding an Exercise or Break hides all hints immediately. Returning to matching content restores them. Opening or cancelling a form does not change eligibility. Reopening, importing, or switching to matching content shows hints regardless of creation history.
5. The overlay has no interactive elements, takes no keyboard focus, and ignores pointer events throughout. Controls remain usable by touch, pointer, and keyboard. Decorative SVGs are hidden from assistive technology; labels remain readable text without live announcements or changes to existing button names.
6. Targets remain correctly aligned on scroll, viewport resize, settings expansion, and narrow or short viewports. Do not draw arrows toward offscreen controls; temporarily hide that target's annotation until visible. Settings expansion temporarily hides its annotation because the collapsed target is hidden. This does not alter eligibility or dismiss the other hints. Sheets render above hints. Layout must not acquire horizontal scrolling.
7. Fresh blank creation still generates independent Routine and Exercise IDs. Random creation, final-entry deletion replacement, persistence, import/export, existing forms, and Session start retain their current behavior.

## Current implementation and ownership

- `src/features/routine-editor/routine-creation.ts`: `createBlankRoutine` currently embeds Practice/300/100 inline; `createRandomRoutine` creates ordinary random Routines.
- `src/domain/routine.ts`: Exercise fields are id, kind, title, tempoBpm, durationSec. Domain `createExercise` has separate defaults; leave those unchanged. Deleting the final entry in `hooks/useRoutineEditor.ts` uses those domain defaults, so deletion need not restore hint eligibility.
- `RoutineEditor/RoutineEditor.tsx` owns composition, Add exercise, and the fixed footer. `RoutineSettings/RoutineSettings.tsx` owns a collapsed disclosure and an inert hidden face. `RoutineEntryList/RoutineEntryList.tsx` renders sortable cards and a separate drag overlay; `RoutineEntryCard/RoutineEntryCard.tsx` owns Exercise edit.
- `RoutineEditor/RoutineEditor.module.css` caps the editor at 28.75rem and fixes the footer at z-index 5. The screenshot's coordinates cannot be used as universal positions.
- `hooks/useRoutineEditor.ts` holds committed Routine content separately from sheet drafts. Derive eligibility from the committed Routine in editor composition; do not add dismissal state to this hook or repository.
- Existing focused tests are `tests/routine-creation.test.ts` and `tests/RoutineEditor.test.tsx`. No new dependency or file-format version is needed.

## Implementation phases

### 1. Share blank Exercise content and eligibility

In `routine-creation.ts`, export `BLANK_ROUTINE_EXERCISE`, a readonly constant containing kind, title, tempoBpm, and durationSec, excluding id. Pass its content into `createExercise` inside `createBlankRoutine` so identities remain fresh. Export `hasBlankRoutineEntries(entries: Routine['entries']): boolean` beside the factory. Check length and discriminant, then compare every content field against the constant. This is content/deep equality for the current flat Exercise shape; do not introduce a generic comparator or serialize full Routines.

Extend `tests/routine-creation.test.ts` for matching content with independent IDs, each differing content field, null values, a Break, zero/multiple entries, and repeated factory identity uniqueness. Retain explicit assertions for the agreed default values rather than deriving every expected value from the constant.

### 2. Render and anchor hints

Create the cohesive `src/features/routine-editor/RoutineHints/` directory with `RoutineHints.tsx`, `RoutineHints.module.css`, and `useRoutineHintAnchors.ts`. Keep geometry measurement in its dedicated hook and rendering in the component. Use one overlay rendered by RoutineEditor only when `hasBlankRoutineEntries(routine.entries)` is true.

Provide explicit optional DOM ref props for the three targets: RoutineEditor owns the Add exercise ref; RoutineSettings accepts the collapsed summary button ref while preserving its existing focus ref; RoutineEntryList forwards an optional edit-button ref only to its sole card; SortableRoutineEntryCard forwards it to RoutineEntryCard's edit button. Do not attach it to the drag overlay copy. Add the corresponding prop types in each dedicated feature file. Avoid document-wide selectors and matching translated or visible button text to locate targets.

Measure target rectangles relative to a fixed editor-width overlay, updating on layout changes through ResizeObserver and scroll/resize listeners while mounted. Observe the editor/target containers so disclosure expansion and content changes update geometry. Clean up listeners and observers. Skip targets with no visible rectangle or outside the viewport. Use bounded local curved paths and label offsets, clamped to the editor/viewport, rather than reproducing the screenshot's long crossing curves. Keep labels outside target button rectangles; reduce curve lengths and label spacing for compact viewports.

Add a reusable hand-drawn arrow SVG component to `src/components/Icons/Icons.tsx` and export it through the existing component barrel if needed. All SVG strokes/paths use currentColor. A small open arrowhead should have substantially shorter strokes than the screenshot. RoutineHints supplies placement/orientation and light high-contrast styling; no raster assets or new font dependency.

Use pointer-events: none for the overlay and all descendants, no tabindex or handlers, and aria-hidden on decorative SVG only. Establish a stacking order above editor surfaces/footer but below BottomSheet; inspect `src/components/BottomSheet/` and its styles before choosing the exact z-index. Keep labels legible without covering controls, including the fixed footer. Do not change editor spacing merely to fit the annotations.

### 3. Verify lifecycle, layout, and record decisions

Extend `tests/RoutineEditor.test.tsx` to cover all three initial labels, saved title/Tempo/Duration edits, adding Exercise/Break, restoration of defaults, name/settings changes, cancelled sheets, reopening, and switching between matching/nonmatching Routines. Verify underlying control actions still open their forms and labels do not change button accessible names. Use actual repository fixtures and current UI interactions. Keep geometry tests focused in `RoutineHints/` with mocked rectangles/observers: resize and scroll refresh positioning, invisible target omission, and unmount cleanup. Do not treat jsdom as visual proof of alignment or click-through CSS behavior.

Add `docs/adr/0011-empty-routine-hints.md` recording the shared template, content-derived eligibility, ignored identities/settings, reversible visibility, and passive overlay. Update `docs/adr.json`. Add a directory inventory entry for `src/features/routine-editor/RoutineHints/` in `docs/files.json` and adjust the routine-creation description. Existing directory entries already cover docs artifacts; preserve the one-entry-per-immediate-docs-directory convention.

Phases 1 and 2 can proceed independently after agreeing on the predicate signature. Phase 3 depends on both. This is a small feature; agent delegation is unnecessary.

### 4. Final implementation handoff

Create `docs/reports/2026-11-04-empty-routine-hints-report.md` with completed work, deviations, commands and results, visual/manual verification results, and remaining risks. Create a separate `docs/reports/2026-11-04-empty-routine-hints-manual-test.md` containing prerequisites, steps, expected outcomes, and cleanup for temporary Routines/browser storage. Report any unexecuted manual gates explicitly.

## Verification

Run from the repository root:

```sh
pnpm exec vitest run src/features/routine-editor/tests/routine-creation.test.ts src/features/routine-editor/tests/RoutineEditor.test.tsx src/features/routine-editor/RoutineHints
pnpm test
pnpm lint
pnpm build
pnpm format:check
```

Focused factory checks cover criteria 1 and 7; editor lifecycle tests cover criteria 2–4 and 7; geometry/DOM tests cover the automated portion of criteria 5–6. Run full tests once after the final implementation and resolve regressions. Format only touched files if needed rather than creating unrelated formatting changes.

Manual gate using `pnpm dev`: inspect at 320×568, 390×844, and desktop width, including scrolling, viewport resizing, settings expansion/collapse, open sheets, and increased text size. Check each arrow endpoint and compact head, label legibility, absence of overlap/horizontal scrolling, click/touch pass-through, keyboard tab order, and sheets above hints. Exercise save/cancel, add, restore, switch, reload, name/settings changes, and imported matching content. Use a disposable browser profile or remove only temporary test Routines afterward. This verifies criteria 3, 5, and 6 beyond jsdom.

## Risks and resolution gates

- Geometry and stacking are the principal risks. Inspect actual BottomSheet stacking before implementation; if an ancestor stacking context prevents the intended order, render the fixed overlay through a body portal with its editor-width bounds measured from the editor container. The required visual order stays unchanged.
- Dense/short screens require shorter paths rather than screenshot-scale arrows. Validate the stated viewport matrix and iterate placement until all three visible targets have legible, nonoverlapping annotations.
- Current Exercise content is flat. If its schema changes during implementation, update the canonical constant and predicate together so every editable content field participates; do not compare IDs.

Completion is binary: acceptance criteria pass, required checks pass, manual gates are executed or explicitly reported as pending, ADR/inventory are updated, and both implementation handoff documents exist. Production behavior must not be claimed visually verified when only DOM tests ran.
