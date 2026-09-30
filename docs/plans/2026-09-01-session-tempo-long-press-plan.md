# Plan: Session Tempo Long Press

Date: 2026-09-01

Status: Ready for implementation

## Scope

- Let a practitioner press and hold the Decrease tempo or Increase tempo button on the ongoing paced Exercise screen to adjust live Tempo continuously.
- Keep the existing one-BPM short-press behavior.
- Recognize a long press at `1,000ms`, then change Tempo at `4 BPM/s` until the press ends or the supported Tempo boundary is reached.
- Support the same behavior for touch, mouse, and stylus input through Pointer Events.
- Keep the interaction local to the Session Timer and the existing live Tempo override path.

## Non-goals

- Do not add long-press behavior to Routine Editor steppers or other controls.
- Do not change the configured Tempo range, the one-BPM adjustment size, Metronome scheduling semantics, or the separate Save tempo action.
- Do not automatically persist Tempo after a long press.
- Do not add acceleration, haptics, visual progress, configurable press timing, or a shared gesture framework.
- Do not add a dependency or change the immutable Session plan.
- Do not alter keyboard and assistive-technology activation beyond preserving the existing one-BPM click behavior.

## Acceptance Contract

### Short press

- Pressing and releasing either Tempo button before `1,000ms` changes live Tempo exactly once by `1 BPM` in the button's direction.
- A short mouse press, touch tap, stylus tap, keyboard activation, or assistive-technology click retains the existing accessible button and click semantics.
- A short press continues to update the displayed Tempo and the live Metronome through the existing Session Tempo override path.

### Long press

- A held Pointer Event becomes a long press at exactly `1,000ms` after pointer-down.
- The first directional one-BPM change occurs at the `1,000ms` boundary.
- Further changes occur every `250ms`, producing a steady rate of `4 BPM/s` with no acceleration.
- Releasing after a long press does not add a click-derived extra change.
- Long press works for touch, mouse, and stylus pointers.
- Pointer capture keeps the active hold running when the pointer drifts outside the visual button until release or cancellation.
- Pointer-up, pointer-cancel, lost pointer capture, component unmount, or reaching the applicable Tempo boundary stops all pending delay and repeat timers.
- A second pointer cannot replace or duplicate an already active hold.

### Tempo and Session behavior

- Decrease never moves below `practiceConfig.tempo.min` (`20 BPM`) and Increase never moves above `practiceConfig.tempo.max` (`300 BPM`).
- Once a boundary is reached, the repeat stops and does not issue redundant state or `AudioController.updateMetronomeTempo` updates.
- Long press remains available whenever the paced Exercise Tempo controls are rendered, including while the Session is paused or interrupted.
- While audio is running, every accepted repeated change uses the established live Metronome update behavior. While audio is paused, interrupted, or unavailable, the UI override still changes without forcing Session Resume or audio activation.
- Save tempo remains visible under the existing divergent-value rule and persists only when deliberately activated.
- Leaving the paced Exercise phase disposes the active press; no delayed or repeated change may affect a later phase.

### Constants

- The two product values are named exports in a Session Timer feature file: the `1,000ms` long-press delay and the `4 BPM/s` repeat rate.
- The `250ms` timer interval is derived from the exported rate rather than represented as a third independently tunable product constant.
- The values are not added to Routine configuration or user settings.

## Current-State Context

- `src/features/session-player/SessionTimer/SessionTimer.tsx` renders the two accessible Tempo buttons. Each currently invokes `onChangeTempo(-1)` or `onChangeTempo(1)` from `onClick` only.
- `src/features/session-player/SessionPlayer/SessionPlayer.tsx` supplies that callback using the rendered `currentTempo` snapshot.
- `src/features/session-player/hooks/useSessionPlayer.ts` owns live Tempo overrides, clamps each change to `practiceConfig.tempo.min/max`, updates React state, and calls `AudioController.updateMetronomeTempo`.
- `src/features/session-player/tests/SessionPlayer.test.tsx` already proves that a normal Increase tempo click changes `90` to `91`, updates the Metronome, and can then be saved.
- No reusable long-press or pointer-repeat behavior exists in the repository. The Routine Editor `Stepper` is click-only and is outside this feature's scope.
- The Tempo controls remain mounted on a paced Exercise while running or paused, so the interaction must clean up independently of Session timing and audio scheduling.

## Confirmed Implementation Decisions

### Ownership and interfaces

- Keep pointer lifecycle, click suppression, timer ownership, and unmount cleanup in `SessionTimer.tsx`, next to the only controls that need this behavior. Do not introduce a general-purpose hook or component.
- Add `src/features/session-player/SessionTimer/tempoPressConstants.ts` containing only the named delay and rate constants. Derive the interval as `1_000 / rate` at the use site.
- Change the live Tempo mutation seam so `useSessionPlayer.changeTempo` derives the current value from `tempoOverridesRef` with the Exercise step's captured Tempo as fallback. Repeated callbacks must not depend on a stale rendered `currentTempo` closure.
- Make `changeTempo` return whether a real change was accepted. Return `false` at a boundary without writing state or calling audio; let `SessionTimer` use that result to stop repetition.
- Update the internal `SessionTimerProps.onChangeTempo` contract to return that boolean. No public application API, Routine schema, or persistence interface changes.

### Pointer lifecycle

- Track one active pointer ID, one long-press delay timer, one repeat timer, and whether the active interaction crossed the long-press boundary.
- On pointer-down, ignore additional pointers, capture the accepted pointer, and schedule the delay using the button direction.
- At the delay boundary, mark the interaction as long, perform the first change, and start the derived `250ms` repeat only if the change succeeded.
- Each repeat asks the state-owning change function for the next one-BPM change. A `false` result clears repetition immediately.
- On pointer-up, clear timers and release the pointer. The subsequent native click performs the single short-press change or is suppressed when the interaction was long.
- On pointer-cancel or lost capture, clear timers and pointer state without manufacturing a Tempo change.
- On unmount or phase replacement, clear both timer types so a Stale callback cannot mutate the next Current phase.
- Preserve the native `button` elements, accessible names, focus behavior, and `onClick` entry point. Pointer behavior supplements rather than replaces accessible click activation.

### Styling and compatibility

- Add only the minimal touch behavior needed to make button holds reliable, using native CSS such as `touch-action: manipulation` and `user-select: none` if browser verification demonstrates selection or gesture interference.
- Do not add platform-specific gesture libraries or global event listeners when pointer capture and component cleanup cover the lifecycle.
- Existing browsers without Pointer Events are not given a custom fallback; their existing click behavior remains available.

## Execution Plan

### 1. Add red UI regressions

File: `src/features/session-player/tests/SessionPlayer.test.tsx`

- Use Vitest fake timers with Testing Library pointer events to assert a release before `1,000ms` causes one one-BPM change only.
- Assert the exact boundary: no repeat change before `1,000ms`, the first change at `1,000ms`, and subsequent changes at each `250ms` interval.
- Assert both Increase and Decrease directions.
- Assert pointer-up stops repetition and the generated click does not add an extra BPM after a long press.
- Assert pointer-cancel and lost pointer capture stop pending/repeating work.
- Assert unmounting or advancing away from the paced Exercise clears pending work.
- Assert a second pointer is ignored while one hold is active.
- Assert repeating stops at `20` and `300` without redundant calls to `audio.updateMetronomeTempo`.
- Retain the existing ordinary click-and-save assertion so accessible click behavior and manual persistence remain protected.
- Assert that Tempo can be held while paused without resuming the Session or starting a new Metronome, while the displayed override still changes.
- Run the focused test and observe the new long-press cases fail before changing production code.

### 2. Make the live Tempo mutation repeat-safe

Files: `src/features/session-player/hooks/useSessionPlayer.ts`, `src/features/session-player/SessionPlayer/SessionPlayer.tsx`

- Change `changeTempo` to accept the Exercise step and direction delta, then read the latest Tempo from `tempoOverridesRef.current[step.sourceExerciseId]`, falling back to `step.tempoBpm`.
- Preserve the existing Exercise guard and `practiceConfig.tempo.min/max` clamp.
- Return `false` when no real change is possible at a boundary; do not update the ref, React state, or AudioController in that branch.
- For an accepted change, synchronously update `tempoOverridesRef`, schedule the React state update, call `audio.updateMetronomeTempo`, and return `true`.
- Remove the rendered `currentTempo` argument from the `SessionPlayer` callback so timer callbacks cannot repeatedly calculate from the original press value.
- Keep Save tempo, saved Tempo comparison, Session-plan immutability, and audio lifecycle behavior unchanged.

### 3. Implement the local pointer-repeat lifecycle

Files: `src/features/session-player/SessionTimer/tempoPressConstants.ts`, `src/features/session-player/SessionTimer/SessionTimer.tsx`

- Export named constants for the `1,000ms` long-press delay and `4 BPM/s` repeat rate.
- Derive the repeat interval from the rate.
- Add refs and small local handlers for the active pointer, delay timer, repeat timer, and long-press click suppression.
- Wire both existing Tempo buttons to the same handlers with `-1` or `1` direction.
- Start with one change at the threshold, repeat at the derived interval, and stop immediately when the mutation callback reports the boundary.
- Preserve the existing `onClick` behavior for short presses and non-pointer activation; consume exactly one post-hold click after a long press.
- Capture the active pointer and handle pointer-up, pointer-cancel, and lost-capture cleanup.
- Add effect cleanup for unmount and Current-phase replacement.
- Keep all timers UI-local; do not route them through `SessionRunner`, which owns Session phase timing rather than input gestures.

### 4. Apply minimal interaction styling and complete automated verification

Files: `src/features/session-player/SessionTimer/SessionTimer.module.css`, `src/features/session-player/tests/SessionPlayer.test.tsx`

- Add native touch/selection declarations only if needed for reliable holding, without changing layout or visible design.
- Run the focused fake-timer suite and confirm all timing, cancellation, boundary, Pause, click, and Save expectations.
- Run adjacent Session and audio suites to ensure repeated overrides do not affect Session scheduling or Metronome behavior.
- Run repository static, build, and full-suite gates.

### 5. Documentation and implementation handoff

Files: `docs/files.json`, `docs/reports/2026-09-01-session-tempo-long-press-report.md`, `docs/reports/2026-09-01-session-tempo-long-press-manual-test.md`

- Update `docs/files.json` because implementation adds `tempoPressConstants.ts` and the `docs/reports/` navigation target; use a cohesive directory entry where appropriate rather than inventorying every internal file.
- Write the implementation report with completed work, deviations from this plan, exact verification results, and remaining risks.
- Write the separate manual test guide with prerequisites, touch/mouse/stylus steps, expected Tempo and Save behavior, boundary checks, paused-session checks, and test-data cleanup.
- Do not update `docs/UBIQUITOUS_LANGUAGE.md`; the feature preserves the existing definitions of Tempo, Metronome, Exercise step, Pause, and Session override.

## Work Parallelism

- Phases 1 through 3 are sequential because the regression contract informs the mutation seam and the pointer lifecycle depends on that seam.
- The CSS compatibility check in Phase 4 can run in parallel with adjacent automated suites after the behavior is implemented.
- The report and manual guide in Phase 5 can be drafted in parallel after implementation behavior is stable, but their verification results must be finalized after all gates complete.
- Delegation is not recommended for implementation: the production change is intentionally small and concentrated in one React flow, so coordination would cost more than it saves.

## Verification

### Focused red/green gate

```sh
pnpm exec vitest run src/features/session-player/tests/SessionPlayer.test.tsx
```

This gate covers short press, exact long-press timing, four-BPM-per-second repetition, click suppression, both directions, cancellation, cleanup, Tempo limits, Pause behavior, Metronome updates, and Save behavior.

### Adjacent safeguards

```sh
pnpm exec vitest run src/services/session/session.test.ts
pnpm exec vitest run src/services/audio/__tests__/AudioController.test.ts
pnpm lint
pnpm format:check
pnpm build
pnpm test
```

- Session tests protect phase replacement and Pause behavior around the UI-local gesture.
- Audio tests protect live Metronome Tempo updates and supported-range handling.
- Report any pre-existing unrelated full-suite failure separately; no Session Player regression may be attributed to baseline noise.

### Manual browser gate

- On a touch device or device emulator, tap Increase and Decrease and confirm each changes Tempo once.
- Hold each button for less than one second and confirm release changes Tempo once only.
- Hold each button through one second and confirm the first change begins at the threshold, continues smoothly at approximately four changes per second, and stops immediately on release.
- Drift the pointer outside the button while holding and confirm repetition continues until release; trigger cancellation where tooling permits and confirm it stops.
- Repeat with a mouse and stylus-capable environment where available.
- Release after several repeated changes and confirm there is no extra final one-BPM jump.
- Hold toward `20 BPM` and `300 BPM`; confirm the value stops at the boundary and the UI remains responsive.
- Pause a paced Exercise step, hold a Tempo button, and confirm Tempo changes without resuming the Session or restarting audio. Resume and confirm the selected Tempo is used.
- Navigate away from a paced Exercise while a delay or repeat is pending and confirm the next Current phase receives no Stale Tempo changes.
- Confirm Save appears after a divergent change, persists only when pressed, and a later Session uses the saved Tempo.
- Confirm no text selection, context menu, page zoom, or scrolling gesture prevents normal long-press operation on the supported mobile browser target.

## Risks and Resolution Branches

- **Synthetic click ordering differs by browser.** Resolve with the manual mobile gate. If a post-pointer click bypasses the suppression flag, keep suppression local and reset it after the click event; do not replace native buttons with custom gesture elements.
- **Pointer cancellation and lost capture may arrive in different orders.** Keep cleanup idempotent and cover each event independently with fake timers. If a platform produces both, repeated cleanup must be harmless.
- **React rerenders can stale the callback captured at pointer-down.** The state-owning `changeTempo` must read `tempoOverridesRef`, and tests must prove a multi-tick hold advances through distinct values rather than repeatedly writing the first value.
- **Fake-timer pointer helpers may not generate the browser's synthesized click.** Resolve by explicitly exercising pointer events plus click in the regression test, then treat the real-browser gate as authoritative for ordering.
- **Mobile long press may invoke selection or a context menu.** First apply native `touch-action` and `user-select` CSS. Add narrower platform-specific suppression only if the supported-browser manual gate still fails, and document the deviation.
- **A phase change can leave timers alive.** Effect cleanup must clear both the initial delay and repeat timers; verify by advancing fake time after unmount/navigation and asserting no Tempo or audio calls.
- No factual product unknown remains. Any platform-specific event-order finding follows the bounded branches above and must not change the agreed timing or persistence semantics.

## Binary Completion Criteria

- A short press changes live Tempo exactly once by `1 BPM`.
- Long press begins at exactly `1,000ms`, changes immediately at that boundary, and continues every `250ms` without acceleration.
- Release after a long press causes no extra change.
- Touch, mouse, and stylus Pointer Events share the behavior while keyboard and assistive clicks retain one-step activation.
- Pointer-up, pointer-cancel, lost capture, unmount, phase replacement, and Tempo bounds stop all pending work without Stale callbacks.
- Repeated changes traverse successive Tempo values, stop at `20/300`, and do not produce redundant audio updates.
- Paused or interrupted Tempo adjustment does not resume the Session or activate audio.
- Save remains deliberate and Session-plan immutability is preserved.
- The two agreed product numbers are named constants in `tempoPressConstants.ts`; the interval is derived from the rate.
- No dependency, shared gesture abstraction, new setting, or unrelated Stepper behavior is introduced.
- Focused Session Player, Session, and audio suites pass; lint, formatting, build, and full-suite results are recorded accurately.
- The manual touch/mouse/stylus, cancellation, Pause, boundary, cleanup, and Save checks pass.
- `docs/files.json` reflects added implementation/report paths.
- `docs/reports/2026-09-01-session-tempo-long-press-report.md` records completed work, deviations, verification, and remaining risks.
- `docs/reports/2026-09-01-session-tempo-long-press-manual-test.md` records prerequisites, steps, expected results, and test-data cleanup.
