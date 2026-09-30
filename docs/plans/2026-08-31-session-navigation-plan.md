# Plan: Session Rewind, Forward, and Paused Progress

Date: 2026-08-31

Status: Ready for implementation

## Scope

- Make Rewind choose between the previous Step and restarting the current Step using a fixed three-second active-time threshold.
- Make manual Rewind and Forward bypass Quick Rest transitions.
- Allow Rewind and Forward while a Session is paused or interrupted without resuming it.
- Keep accumulated progress visible while a paced timed Exercise step is paused or interrupted.
- Preserve the established Session lifecycle, audio cleanup, and Stale event protections while navigation changes Current phase.

## Non-goals

- Do not make the three-second threshold configurable in a Routine.
- Do not add Quick Rest to the ordered Step list, progress segments, or Now Playing list.
- Do not change automatic Quick Rest behavior after normal timed Exercise Completion.
- Do not invent percentage progress for an Open-ended step.
- Do not redesign the Session controls or replace their icons.
- Do not add dependencies, new Session commands, or speculative navigation abstractions.

## Acceptance Contract

### Rewind

- During an Exercise step or Break step, Rewind uses active elapsed time, excluding time spent paused or interrupted.
- At elapsed time strictly below `3.000s`, Rewind starts the previous Step from its beginning.
- At elapsed time equal to or greater than `3.000s`, Rewind restarts the current Step from its beginning.
- If the current Step is the first Step, Rewind restarts it regardless of elapsed time.
- “Previous” means the preceding meaningful Step in Session-plan order. It may be an Exercise step or Break step. Only Quick Rest is bypassed.
- During Quick Rest, Rewind always starts the preceding Exercise step from its beginning, regardless of Quick Rest elapsed time.
- A restarted Timed step gets its full Duration; a restarted Open-ended step gets `00:00` Elapsed time; a paced Exercise starts a fresh Beat grid only when running or later resumed.
- The Rewind control keeps its existing icon and has the accessible name and title `Rewind`.

### Forward

- Forward always finishes the current Step manually and starts the next Step from its beginning; the three-second threshold does not apply.
- If a Quick Rest follows the current Exercise step, Forward bypasses it and starts the next Step directly.
- During Quick Rest, Forward bypasses the rest and starts the following Exercise step directly.
- Forward on the final Step completes the Session and presents `Routine complete`.

### Pause and interruption

- Rewind and Forward work while status is `paused` or `interrupted` and preserve that exact status when another Step is selected or restarted.
- Navigation never implicitly resumes a paused or interrupted Session.
- A target Timed step is shown paused at its full Duration with zero progress; a target Open-ended step is shown paused at `00:00`.
- A target paced Exercise does not start audio or Beats until Resume.
- Paused Quick Rest follows the same navigation rules and remains paused or interrupted after the target is selected.
- Forward on the final Step completes the Session because no Current phase remains on which to preserve Pause.

### Progress and audio

- Pausing or interrupting a paced timed Exercise freezes and continues to show the Timer Ring arc at the accumulated fraction.
- The displayed elapsed/remaining values remain frozen until Resume or navigation.
- Existing frozen progress for unpaced Timed steps, Break steps, and Quick Rest remains unchanged.
- An Open-ended step continues to show Elapsed time without a determinate Timer Ring arc. A paced Open-ended Exercise keeps BPM in the ring and frozen Elapsed time in the heading.
- Rewind, Finish step, and Skip Quick Rest do not play Exercise, Break, Quick Rest, or Session Completion cues.
- Automatic timed Completion continues to play the existing Completion cues, enter Quick Rest where planned, and eventually play the Session Completion cue.
- Rewinding a Step resets its Warning cue eligibility; navigation cancels callbacks belonging to the replaced Current phase.

## Diagnosis

### Current flow and ownership

- `src/services/session/sessionReducer.ts` owns Session status, Current phase, timing state, and navigation transitions.
- `sessionReducer.rewind` currently accepts only `running`, then calls `enterStep` with `currentStepIndex`; it therefore always restarts the current Step and cannot navigate while paused or interrupted.
- `SKIP_STEP` currently calls the same `advance` path as automatic `STEP_COMPLETED`. That path enters a planned Quick Rest, so manual Forward cannot bypass it.
- `src/features/session-player/hooks/useSessionPlayer.ts` explicitly resumes a paused Session before `skipStep`, while Rewind is passed through unchanged. This creates asymmetric Pause behavior in the caller.
- `src/services/session/SessionRunner.ts` already centralizes timer cancellation, Step/Quick Rest stop hooks, scheduling, and Stale event rejection around reducer transitions.
- `src/features/session-player/SessionPlayer/SessionPlayer.tsx` calculates frozen remaining and elapsed values from `pausedRemainingSec` and `pausedElapsedSec`. However, `beatProgress` explicitly returns `null` for `paused` and `interrupted`; `TimerRing` interprets `null` as open-ended and omits the paced Exercise progress arc.
- Step and Quick Rest Completion cues are already limited to `STEP_COMPLETED`. The Session Completion hook receives no completion reason, so the current UI adapter plays `session-complete` after both automatic and manual final-step completion.

### Evidence

- A temporary deterministic reducer regression test advanced to Step index `1`, issued Rewind after two active seconds, and failed with `expected 1 to be 0`.
- The isolated red-capable command was:

  ```sh
  pnpm exec vitest run src/services/session/navigation-regression.tmp.test.ts
  ```

- The temporary test was removed after reproduction; it must be recreated permanently in `src/services/session/session.test.ts` during implementation.
- Relevant baseline suites are green before implementation:

  ```text
  pnpm exec vitest run src/services/session/session.test.ts src/features/session-player/tests/SessionPlayer.test.tsx
  Test Files  2 passed (2)
  Tests      22 passed (22)
  ```

- The full suite is not a green planning baseline: the planning run exposed four unrelated existing failures in `src/features/routine-editor/tests/RoutineEditor.test.tsx` concerning stale Routine Settings expectations. These failures are outside this plan and must not be attributed to this change.

### Root-cause assessment

- High confidence: manual Forward and automatic Completion are represented by distinct commands but collapsed into the same `advance` implementation, which erases the product distinction around Quick Rest.
- High confidence: Rewind lacks both elapsed-time branching and support for paused/interrupted status.
- High confidence: the React adapter's forced Resume causes the observed paused-Forward behavior; the reducer currently cannot preserve Pause even if that Resume is removed.
- High confidence: paused paced progress disappears because of the explicit paused/interrupted guard in `beatProgress`, not because paused timing data is missing.
- High confidence: no additional persistence, audio-clock, Routine-model, or Quick Rest plan changes are required.

### Why coverage misses the bugs

- The existing Break rewind test asserts the old “always restart current Step” behavior and has no before/at/after-threshold cases.
- The existing Quick Rest test covers Rewind and Skip only after Quick Rest has already started; it does not assert that manual Finish step bypasses Quick Rest.
- The existing Session Player test explicitly expects Finish step to enter Quick Rest and must be updated to the agreed behavior.
- Pause coverage verifies frozen timing and Resume but does not exercise Rewind or Forward while paused/interrupted.
- No UI test asserts that the paced Timer Ring retains a determinate arc during Pause.
- No test distinguishes automatic from manual final Session Completion cues.

### Unknowns

- No product decisions remain open after the approved interview.
- The unrelated Routine Editor suite failures need separate ownership; they do not block focused red/green work but do block claiming a green full-suite gate unless independently resolved.

## Design

### Central decision and seam

Keep navigation policy behind the existing `sessionReducer(state, command)` interface. The reducer has the Session plan, phase, status, active elapsed time, and target index needed to decide correctly. Callers must not calculate thresholds, inspect Quick Rest adjacency, or emulate Pause preservation.

`SessionRunner` remains the orchestration module at the clock/audio seam. It observes the reducer's before/after states, cancels replaced scheduling, and starts timers/audio only for `running` state. The React hook remains a thin adapter that dispatches user intent without changing Session status first.

### State lifetime and invariants

- Use a module-local constant for the `3_000ms` Rewind threshold.
- Active elapsed time is derived from `now - currentStepStartedAt` while running and from `pausedElapsedSec` while paused or interrupted.
- Quick Rest is never a manual navigation target. It remains a transition associated with the preceding Exercise step.
- Automatic `STEP_COMPLETED` may enter Quick Rest; manual `SKIP_STEP` always advances directly to the next Step.
- Entering a Step through navigation creates a fresh segment lifetime and resets elapsed/remaining and Warning state.
- A navigated-to Step preserves `paused` or `interrupted`; ordinary running navigation stays `running`; advancing past the final Step becomes `completed`.
- Paused/interrupted targets have no live `currentStepEndsAt`, retain zero `pausedElapsedSec`, and retain full `pausedRemainingSec` for a Timed step. Resume reconstructs live start/end timestamps through the existing lifecycle.
- No timer or audio work is scheduled until target status is `running`.
- Manual and automatic completion reasons remain distinguishable through the Session Runner hook seam so audio policy does not leak into reducer state.

### Interface effects

- Keep the existing `REWIND` and `SKIP_STEP` commands and `SessionRunner.rewind/skipStep` methods.
- Simplify `useSessionPlayer.finishOrSkip` so it dispatches `skipStep` directly and does not accept or act on a `paused` flag.
- Pass the completing command/reason to `onSessionComplete`, or make an equivalently small change at that seam, so the audio adapter can suppress the Session Completion cue after manual Forward without suppressing the Completion screen.
- Do not expose the threshold, target index, or Pause reconstruction through new public interfaces.

## Execution Plan

### 1. Add red reducer and runner regressions

File: `src/services/session/session.test.ts`

- Replace the old unconditional Break-rewind expectation with threshold-aware cases at `2.999s` and exactly `3.000s`.
- Cover Exercise steps, Break steps, the first Step, Open-ended steps, and a previous Step that is itself a Break.
- Assert that running Rewind starts the selected Step fresh and invalidates stale timers.
- Assert that manual Forward from an Exercise bypasses a planned Quick Rest, while automatic `STEP_COMPLETED` still enters it.
- Assert both directions during Quick Rest: Rewind to the preceding Exercise step and Forward to the following Exercise step.
- Assert the same matrix for `paused` and `interrupted`, including exact status preservation, full/zero target timing state, no scheduling until Resume, and fresh timing after Resume.
- Assert that Forward on the final paused Step completes the Session.
- Assert hook reasons and cue-relevant completion behavior for automatic versus manual completion.
- Run the focused test and observe the new cases fail before changing production code.

### 2. Correct navigation ownership in the reducer

File: `src/services/session/sessionReducer.ts`

- Add the fixed module-local Rewind threshold and one private active-elapsed calculation.
- Extend Rewind eligibility to `running`, `paused`, and `interrupted`.
- Choose the current or previous Step index according to phase, threshold, and first-Step bounds.
- Separate manual advance from automatic Completion: `SKIP_STEP` goes directly to the next Step; `STEP_COMPLETED` retains the Quick Rest path.
- Adapt the existing Step-entry helper, rather than adding a parallel state constructor, so running and paused/interrupted targets initialize consistently.
- Preserve exact paused versus interrupted status and reset Warning/timing fields for each fresh target segment.
- Keep completion, Quick Rest lookup, and stale-event guards unchanged except where the new manual/automatic distinction requires it.

### 3. Preserve lifecycle and completion-reason behavior

Files: `src/services/session/SessionRunner.ts`, `src/features/session-player/hooks/useSessionPlayer.ts`

- Verify that changed segment keys still cancel replaced timers and audio callbacks.
- Keep scheduling and `onStepStart` gated on `running`, so paused navigation remains silent until Resume.
- Carry the completion command/reason through `onSessionComplete` and play `session-complete` only for automatic Completion.
- Remove the forced Resume from `finishOrSkip`; dispatch manual Forward directly and let reducer state decide whether Pause is preserved.
- Do not add a second navigation state machine in the hook.

### 4. Keep paused paced progress visible

Files: `src/features/session-player/SessionPlayer/SessionPlayer.tsx`, `src/features/session-player/tests/SessionPlayer.test.tsx`

- Derive paced Timer Ring progress from frozen `pausedElapsedSec` while paused/interrupted and from the live Beat/time source while running.
- Keep the result determinate for a paced Timed Exercise so `TimerRing` renders the frozen arc.
- Retain `null` progress for Open-ended steps.
- Update the old UI expectation that Finish step enters Quick Rest; it must now show the next Step directly.
- Add UI coverage for Rewind's accessible name `Rewind`, paused Forward/Rewind status preservation, no Metronome restart during paused navigation, frozen paused arc, and no manual Completion cue.

### 5. Align the control label and domain documentation

Files: `src/features/session-player/SessionControls/SessionControls.tsx`, `docs/UBIQUITOUS_LANGUAGE.md`

- Change only the Rewind button's accessible name and title to `Rewind`; retain its icon and layout.
- Add the stable Rewind semantics to the Session controls vocabulary: previous Step below three active seconds, otherwise restart current Step, with Quick Rest bypass and Pause preservation.
- Do not update `docs/files.json` unless implementation adds or removes files or directories; none are planned.

## Verification

### Red/green focused gates

1. Session navigation and scheduling:

   ```sh
   pnpm exec vitest run src/services/session/session.test.ts
   ```

2. Session Player behavior and paused progress:

   ```sh
   pnpm exec vitest run src/features/session-player/tests/SessionPlayer.test.tsx
   ```

3. Run both focused suites together to catch shared fake-clock/audio lifecycle leakage:

   ```sh
   pnpm exec vitest run src/services/session/session.test.ts src/features/session-player/tests/SessionPlayer.test.tsx
   ```

### Adjacent safeguards

- Run audio tests because completion-reason and Metronome lifecycle behavior crosses that adapter:

  ```sh
  pnpm exec vitest run src/services/audio/__tests__/AudioController.test.ts
  ```

- Run static and build gates:

  ```sh
  pnpm lint
  pnpm format:check
  pnpm build
  ```

- Run the full suite:

  ```sh
  pnpm test
  ```

  Do not claim this gate is green if the known Routine Editor failures remain. Report those failures separately and verify that no Session-related tests fail.

### Manual browser gate

- Use a Routine containing `Exercise A -> Break B -> Break C -> Exercise D` and verify that early Rewind moves one meaningful Step at a time, including Break B.
- Verify Rewind at `2.9s` goes back and at/after `3.0s` restarts the current Step.
- Use adjacent Exercises with positive Quick Rest Duration. Verify automatic timed Completion shows Quick Rest, while manual Forward bypasses it; verify both buttons during Quick Rest choose the correct Exercise.
- Repeat Rewind and Forward from Pause and after background interruption. Confirm the selected Step changes but the Resume button remains visible and no audio starts.
- Pause a paced Timed Exercise after visible progress and confirm the arc, displayed time, and heading remain frozen.
- Resume and confirm Countdown, Beat grid, Warning cue, and Metronome continue from the newly selected Step without a stale callback from the replaced phase.
- Forward through the final Step while paused and confirm the Completion screen appears without a manual Completion cue.

## Risks

- Off-by-one errors at exactly three seconds: pin boundary tests to `2_999ms` and `3_000ms` using the fake clock.
- Mixing Quick Rest's preceding `currentStepIndex` with a real Step target can move two Steps backward; keep phase-specific target selection in the reducer and test both directions.
- Reconstructing paused targets incorrectly can cause immediate Completion on Resume or start audio while paused; assert paused timing fields and scheduler hooks directly.
- Reusing automatic `advance` for manual Forward would silently reintroduce Quick Rest; keep separate command paths covered by adjacent tests.
- A same-ID restarted segment can accept a Stale event if its lifetime key is not renewed; retain a fresh start instant and the existing segment-key checks.
- Existing unrelated full-suite failures can hide regressions in aggregate output; focused Session gates must be green independently.

## Binary Completion Criteria

- Every acceptance rule above has a focused automated assertion at the reducer/runner or UI seam.
- Rewind uses the exact `<3.000s` versus `>=3.000s` rule and never lands on Quick Rest.
- Manual Forward never enters Quick Rest; automatic Completion behavior is unchanged.
- Paused and interrupted navigation preserve status and remain silent until Resume.
- Paused paced Timed Exercise progress remains visibly frozen; Open-ended presentation remains indeterminate.
- Manual navigation produces no Completion cues, including on the final Step; automatic cues remain intact.
- Replaced phase timers, warnings, and audio callbacks remain stale and harmless.
- Focused Session, Session Player, and audio suites pass.
- Lint, formatting, and build gates pass.
- The full-suite result is reported honestly, including the pre-existing Routine Editor failures if they remain.
- Manual browser checks pass on running, paused, interrupted, Quick Rest, first-Step, and final-Step paths.
- No new dependency, Routine setting, Session command, file, or directory is introduced unless implementation evidence requires and documents a deviation.
