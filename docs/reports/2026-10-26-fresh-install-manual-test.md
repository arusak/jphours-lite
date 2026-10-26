# Fresh-install welcome and random Routines manual test guide

## Prerequisites

Use a browser profile or site-storage state with no `rhythm-practice-trainer/routines` or `rhythm-practice-trainer/routine` local-storage keys. Keep an export of any Routine data before clearing production storage.

## Steps and expected results

1. Open the app. The welcome heading is focused and no Routine or Session starts. It shows the empty, random, and import actions plus the 20 minutes plus 20 seconds helper.
2. Choose **Create empty routine**. The editor opens for `New routine`; its sole Exercise is `Practice`, 300 seconds, and 100 BPM. Reload and confirm it remains selected.
3. Delete that final Routine from the Routines drawer and confirm. The welcome screen returns and remains after reload.
4. Choose **Create random routine**. Confirm five distinct named Exercises, Durations of 180, 180, 240, 300, and 300 seconds, Tempos of 80 through 120 in a mixed order, and a 5-second Quick Rest. The editor displays 21 min and a Session displays 20:20.
5. From welcome choose **Import routine**, select a valid exported file, verify its preview, and choose **Add routine**. The imported Routine opens. Cancelled, invalid, or unreadable files leave welcome visible.
6. Simulate unavailable browser storage, then try creation, final deletion, and import. Confirm the error remains visible and each action can be retried without a false transition.
7. With a waiting PWA update available, accept the update from both a selected Routine and welcome state. Confirm the current persisted state survives reload.

## Cleanup

Delete test Routines through the app and restore saved browser storage or import the Routine export made before testing.

## Automated gate results

`pnpm exec vitest run src/services/persistence/routine-repository.test.ts src/features/routine-editor/tests/routine-creation.test.ts src/features/routine-editor/tests/RoutineEditor.test.tsx src/app/App.test.tsx` passed with 71 tests. `pnpm build` passed. The PWA waiting-update scenario remains a browser-environment manual check.
