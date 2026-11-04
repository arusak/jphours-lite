# Routine header and drawer implementation report

## 1. What was the task?

Implement the [Routine header and drawer plan](../plans/2026-11-04-routine-header-drawer-plan.md): title-based name editing, hamburger Routine management, Duration/settings composition, and file transfer within one drawer.

## 2. What was your analysis?

Existing ownership supports a local presentation change: RoutineSettings retains settings state, RoutinePicker owns the single management modal, and useRoutineEditor retains persistence and transitions. The shared file hook continues validation and additive import; extracting preview markup avoids duplicating the welcome flow.

Two baseline discrepancies were found. WelcomeScreen had its existing import component commented out; it was restored to meet the explicit empty-collection import acceptance criterion. The hint-anchor test expects an arrow coordinate of 393 but receives 397. Running that test against an archived, unmodified HEAD in `/tmp/routine-baseline.cHq0SM` reproduced the exact failure at `useRoutineHintAnchors.test.tsx:110`; unrelated hint geometry was left unchanged.

## 3. What changes were made?

- Replaced the pencil with a native title button and current-color hamburger; retained heading identity and welcome focus behavior.
- Added a Duration presentation slot to RoutineSettings, preserving its expansion, sound sheet, and summary anchor.
- Moved Import/Export beneath New routine in RoutinePicker with compact dashed styling, in-dialog explanations, and export status.
- Switched one BottomSheet between list and shared import preview. Cancel restores Import focus, failed saving retains preview, and successful saving closes the drawer. File-request invalidation protects against stale reads after dismissal.
- Restored the existing welcome import component and added focused regression coverage for header, modal transitions, capacity, status, focus, cancellation, and welcome import.
- Recorded [ADR 0012](../adr/0012-routine-header-drawer.md) and indexed it. Existing cohesive inventory entries cover the added component and documentation.

## Verification and limitations

Commands run: focused RoutineEditor/Picker Vitest tests, `pnpm exec tsc -b`, `pnpm test`, `pnpm lint`, `pnpm build`, and `pnpm format:check`. Focused tests: 54 passed. Type checking, lint, production build, and formatting passed. Full suite: 236 passed and one failed across 22 files; the sole failure is the independently reproduced baseline hint-anchor assertion described above.

A separate agent reviewed connected production code using the Ponytail review skill, tracing persistence, preview cancellation, sheet exit snapshots, focus, and file validation. No introduced correctness issue was identified.

Manual browser gates were not performed: no callable browser runtime or installed headless browser was available. Layout at 320px, real keyboard activation, native file-picker cancellation, downloads, reduced motion, and visual hint alignment remain unverified. See the [manual test guide](2026-11-04-routine-header-drawer-manual-test.md) for steps and cleanup. Automated DOM tests do not establish these visual/native behaviors.

The implementation is complete with the above verification limitations; the plan's manual acceptance gate remains open.
