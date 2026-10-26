# Fresh-install welcome and random Routines implementation report

## 1. What was the task?

Implement the fresh-install welcome flow, empty Routine collections, minimal and random Routine creation, and welcome import support described in the 2026-10-26 plan.

## 2. What was the analysis?

The persisted collection previously required both a selected Routine and at least one record, which caused first launch and final deletion to create a default Routine. The editor and app startup also assumed a selected Routine throughout. The change therefore makes selection nullable at the collection and editor boundaries while retaining the invariant that each individual Routine contains at least one entry.

## 3. What changes were made?

- Persist canonical empty collections and preserve them over legacy storage; final deletion now commits the empty state.
- Add minimal and random Routine factories with the specified names, Exercise pool, Durations, Tempos, and 5-second Quick Rests.
- Render an accessible welcome screen for an empty collection, with empty/random creation and the existing import preview flow.
- Keep export and editor-only controls unavailable without a selected Routine; preserve update acceptance and focus transitions.
- Update startup restoration, ADRs, ubiquitous language, inventory, and focused tests.

## Verification

- `pnpm exec vitest run src/services/persistence/routine-repository.test.ts src/features/routine-editor/tests/routine-creation.test.ts src/features/routine-editor/tests/RoutineEditor.test.tsx src/app/App.test.tsx` — 71 passing tests.
- `pnpm build` — passed.

Remaining risk: PWA update acceptance was covered through the existing shared callback path but was not manually exercised in a browser with a waiting service worker.
