# Implementation Report: Routine Metronome Improvements

Date: 2026-08-10

## Delivered

- Added modern `@dnd-kit/react` Routine entry sorting with a handle-only activator, drag overlay, stable-ID move transition, and autosave.
- Added the default-enabled `Alternate beat tone` Routine setting, old-data normalization, validation, and automatic saving from both Routine Editor and Session.
- Added `BeatClock` audible-boundary snapshots, four-position descriptors, secondary-tone synthesis three semitones lower, live Tempo rescheduling without artificial Beats, and beat-grid Warning cues.
- Updated beat dots and paced `TimerRing` progress to consume audible Beat snapshots.
- Made Routine settings an accessible, reduced-motion-aware collapsed disclosure.
- Added controlled Bottom Sheet presence with exit snapshots, focus restoration, repeated-action protection, and fallback completion.
- Restarted BeatClock publication when a paused Metronome resumes, without resetting Beat order.
- Preserved the closest queued Beat during a live Tempo change and applied the new Tempo to the following interval.
- Kept a paced TimerRing visible at 100% for one animation frame before presenting Completion.
- Kept the closing Bottom Sheet backdrop intercepting pointer input throughout its exit animation.
- Added focused sound-change coverage confirming existing scheduled Beats remain intact and later Beats use the selected Metronome sound.

## Verification

- `pnpm test` — 61 passed.
- `pnpm build` — passed.
- `pnpm lint` — passed.
- `pnpm format:check` — passed.
- `git diff --check` — passed.

## Implementation Notes

- dnd-kit 0.5 exposes a projected sortable index for keyboard moves; the application resolves that index to a stable Routine entry ID before applying the pure move operation.
- jsdom lacks several browser layout and animation APIs required by dnd-kit. Focused test setup supplies minimal non-production stubs; the integration test verifies the real Keyboard sensor activation on the drag handle and the pure transition verifies projected-index persistence.

## Follow-up Status

The five review findings have been implemented and verified. No deviations from the agreed implementation plan were required. The follow-up commit is recorded after this report update.
