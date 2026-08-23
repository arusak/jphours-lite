# Plan: Web Audio Startup and Session Lifecycle

Date: 2026-08-12

Status: Implementation plan for H-02 and H-03. No application code was changed while preparing this plan.

Source findings: [H-02](2026-08-08-critical-high-bug-audit.md#h-02--a-pending-web-audio-unlock-leaves-the-session-screen-blank) and [H-03](2026-08-08-critical-high-bug-audit.md#h-03--web-audio-is-not-reactivated-after-interruption-and-teardown-leaks-contexts) in the critical/high bug audit.

## Goals

- Start the Session Runner and render the first Current phase without waiting for Web Audio.
- Begin Web Audio activation synchronously from the Start session and Resume gestures.
- Represent Web Audio readiness explicitly so a failure never looks like a successful Metronome start.
- Recover from suspended, non-standard `interrupted`, rejected, and never-settling contexts with bounded work.
- Give the practitioner a visible Retry audio action while the Countdown, Elapsed time, and Session controls remain usable.
- Release every Session's Web Audio resources safely and idempotently.

## Out of Scope

- Changing Session timing, progression, or background-interruption rules.
- Playing missed Beats, Warning cues, or Completion cues after audio recovers.
- Persisting or restoring an Interrupted session after process termination.
- Changing Metronome sound synthesis, Beat synchronization, Tempo overrides, or volume behavior.
- Solving Wake Lock ownership from H-04.
- Treating audio failure as a reason to Pause, Stop session, or prevent Completion.

## Design Decisions

### Audio never owns Session progress

- `SessionRunner.start(routine)` runs as soon as the Session Player initializes. It is not chained to `ensureRunning()`, a `finally` callback, or any other audio promise.
- Resume continues the Session Runner immediately. Audio reactivation begins from the same click handler, but its promise is not awaited before `runner.resume()`.
- Failed or delayed audio affects only audible Beats and cues. The first Current phase, Countdown or Elapsed time, and all Session controls remain rendered.

### Activation begins inside user gestures

- `App` owns one reusable `AudioController` instance and passes it to the active `SessionPlayer`.
- The app-level Start session callback invokes `audio.ensureRunning()` synchronously before setting the active Routine. This preserves the browser user-activation opportunity that is currently lost by first calling `resume()` in a React effect.
- The Resume and Retry audio button handlers invoke `ensureRunning()` directly from their click tasks.
- `RoutineEditor` retains its domain-level `onStartSession(routine)` contract and does not import Web Audio types. Audio orchestration stays in `App` and the Session Player feature.

### Explicit audio lifecycle

Expose an external-store snapshot from `AudioController`, following the existing `BeatClock` subscription shape, with these UI-relevant states:

- `idle`: no context has been requested for the next Session yet.
- `activating`: context creation or a bounded resume/recovery attempt is in progress.
- `running`: the current context has been verified as `state === 'running'`.
- `unavailable`: Web Audio is unsupported or the bounded attempt failed, rejected, threw, or stayed pending.

The snapshot also carries a monotonically increasing generation. Context `statechange` listeners normalize standard `running`, `suspended`, and `closed` states plus WebKit's non-standard `interrupted` string. A stale listener or late promise from an older generation cannot change the active snapshot.

`startMetronome()`, `resumeMetronome()`, cue playback, and gain creation must require the current context to be verified as running. Scheduling nodes on a suspended or interrupted context does not count as success.

### Bounded recovery and context replacement

Replace `unlock()` with an idempotent `ensureRunning()` operation:

1. Reuse the current running context when possible.
2. For `suspended` or `interrupted`, call `resume()` and race the state transition against a short injected timeout.
3. If resume rejects, throws, resolves without reaching `running`, or times out, retire that context and make one bounded attempt with a fresh context.
4. If the replacement still does not reach `running`, publish `unavailable` and return `false`. Do not leave the caller waiting indefinitely.
5. Deduplicate concurrent calls for the same context generation. A new explicit Retry may start a new bounded attempt after the previous attempt finishes.

Keep the timeout value a named implementation constant and inject timer functions through `AudioControllerOptions` so tests use fake time. Do not loop context creation: one original context plus one replacement is the maximum per call.

Retiring a context stops pending sources and the scheduler, disconnects owned nodes, removes its `statechange` listener, clears controller references, and calls `close()` on a best-effort basis. Promise completion from a retired context is ignored by generation checks.

### Re-synchronize only the Current phase

Audio recovery does not replay history. After `ensureRunning()` succeeds, `useSessionPlayer` reconciles audio with `runner.getState()`:

- For a running paced Exercise step, start its Metronome with the current Session Tempo, Metronome sound, and Alternate Beat tone overrides.
- If that step still has an eligible future Warning cue, schedule it from its current remaining time. Do not emit an already missed Warning cue.
- For an unpaced Exercise step, Break step, Quick Rest, paused Session, Interrupted session, completed Session, or stopped Session, keep the Metronome stopped.

Track the active audio phase by Session segment key plus audio-context generation so the initial activation callback and `onStepStart` cannot start the same Metronome twice. A new context generation deliberately re-synchronizes the current paced Exercise step.

### Practitioner-facing recovery

- Replace the boolean `audioAvailable` flag with the explicit audio snapshot.
- While activation is pending, show a compact status such as `Starting audio… Timers and controls still work.`
- When unavailable, show `Audio is unavailable. Timers and controls still work.` with a `Retry audio` button.
- Retry changes the status to activating immediately, invokes the bounded recovery path, and leaves Session progress untouched.
- Keep the existing Interrupted session alert separate. Audio recovery messaging uses `role="status"`; it must not repeatedly announce every raw browser `statechange`.

### Ownership and teardown

- The app-level Session lifecycle owns the reusable controller. Session Player cleanup disposes the Session Runner and Wake Lock observers but does not accidentally destroy a context during React Strict Mode's development effect replay.
- When the active Session exits or the owning app unmounts, call `audio.dispose()` exactly once at the ownership boundary. The method itself remains safe under repeated calls.
- `dispose()` synchronously stops scheduling and sources, disconnects gain nodes, removes listeners, invalidates pending activation work, clears the context reference, and invokes `AudioContext.close()` with rejection contained.
- The controller may create a fresh context for a later Session after disposal; it must never reuse a closed context.

## Implementation Steps

### 1. Define the audio lifecycle contract

Files: `src/services/audio/types.ts`, `src/services/audio/index.ts`, and a focused lifecycle store in `src/services/audio/` if separating it keeps `AudioController` cohesive.

1. Add the audio lifecycle state and snapshot types, including the context generation.
2. Add `subscribeToState` and `getStateSnapshot` contracts compatible with `useSyncExternalStore`.
3. Extend `AudioControllerOptions` with bounded-recovery clock dependencies and the timeout duration.
4. Document that `ensureRunning()` is safe to call repeatedly and resolves within the configured bound.

### 2. Implement bounded `ensureRunning()`

Files: `src/services/audio/AudioController.ts` and `src/services/audio/__tests__/AudioController.test.ts`.

1. Replace `unlock()` with `ensureRunning()` and centralize context creation, listener attachment, state normalization, and generation checks.
2. Treat both `suspended` and WebKit `interrupted` as states requiring `resume()`.
3. Bound each activation attempt, deduplicate same-generation calls, and replace one failed or stuck context at most once per invocation.
4. Ignore late resume resolutions and state events from retired contexts.
5. Require a verified running context in every scheduling and gain-node entry point.

### 3. Make teardown complete and reusable

Files: `src/services/audio/AudioController.ts` and its focused tests.

1. Extract one retirement path shared by recovery replacement and `dispose()`.
2. Stop the Metronome scheduler, active oscillators, scheduled Warning sources, and pending BeatClock notifications.
3. Disconnect gains, detach `statechange`, clear references before awaiting anything, and contain `close()` rejection.
4. Make a second `dispose()` a no-op and allow a later explicit activation to create a new context.

### 4. Move the first activation into Start session

Files: `src/app/App.tsx`, `src/features/session-player/SessionPlayer/SessionPlayer.tsx`, and `src/features/session-player/hooks/useSessionPlayer.ts`.

1. Create the reusable `AudioController` at the app ownership boundary without eagerly creating an `AudioContext`.
2. In the Start session callback, call `ensureRunning()` before setting `activeRoutine` and pass the controller into `SessionPlayer`.
3. Start the Session Runner independently during Session Player initialization; remove all promise chaining around runner startup.
4. Dispose audio when that active Session leaves the app ownership boundary, while keeping Strict Mode effect replay safe.

### 5. Reconcile audio on activation and Resume

Files: `src/features/session-player/hooks/useSessionPlayer.ts` and focused Session Player tests.

1. Subscribe React to the controller's audio lifecycle snapshot.
2. Extract a helper that reconciles the verified running context with the current Session phase and live overrides.
3. Use phase and context-generation guards to prevent duplicate Metronome starts.
4. From Resume, invoke `ensureRunning()` and `runner.resume()` without awaiting audio.
5. On successful initial activation, Resume, or Retry, reconcile only the Current phase and reschedule only a future eligible Warning cue.

### 6. Add visible Retry audio behavior

Files: `src/features/session-player/SessionPlayer/SessionPlayer.tsx`, `src/features/session-player/SessionPlayer.module.css`, and focused tests.

1. Render activation and unavailable statuses without replacing Session content.
2. Add an accessible `Retry audio` button for the unavailable state.
3. Wire Retry directly to the hook's activation action and prevent duplicate clicks while activating.
4. Preserve the distinct Interrupted session alert and existing Session controls.

## Focused Test Coverage

### AudioController

- A running context resolves `ensureRunning()` without calling `resume()`.
- Standard `suspended` and non-standard `interrupted` contexts call `resume()` and publish `running` only after the state is verified.
- Unsupported construction, a throwing factory, rejected resume, and resume resolving while still suspended return `false` within the bound.
- A never-settling resume times out, retires the old context, and attempts exactly one fresh context.
- A successful replacement publishes its new generation and can schedule Beats and cues.
- Late resolution and late `statechange` from the retired context do not overwrite replacement state.
- Concurrent calls share one same-generation activation attempt; a later explicit Retry can begin another.
- Metronome and cue methods refuse to schedule while suspended, interrupted, closed, or unavailable.
- Disposal stops sources and timers, disconnects nodes, removes listeners, calls `close()`, contains close rejection, and clears the reference.
- Double disposal does not close twice, and a later Session creates a new context rather than reusing the closed one.
- Disposal during a pending resume prevents that promise from reviving the retired context.

### App and Session Player

- Start session calls `ensureRunning()` from the click handler before the Session screen is activated.
- Resolving, rejecting, throwing, and never-settling activation all render the first Current step and Session controls immediately.
- A never-settling activation reaches the unavailable status under fake time instead of leaving blank content.
- A successful delayed activation starts the current paced Metronome once and schedules only a still-future Warning cue.
- An unpaced Current phase never starts a Metronome after recovery.
- Background interruption stops the Metronome; clicking Resume calls `ensureRunning()` again and advances the Session Runner without waiting.
- Suspended/interrupted recovery restarts the current paced Metronome once with the latest Tempo and sound overrides.
- Retry is visible after failure, is invoked from the button gesture, and does not reset Countdown, Elapsed time, or Step position.
- Missed Beats and Warning cues are not replayed after recovery.
- Exit/Stop and repeated teardown close the Session context without an unhandled rejection.
- Development Strict Mode does not close the just-activated context during effect replay or create duplicate contexts.

## Verification

1. Run `pnpm test -- src/services/audio/__tests__/AudioController.test.ts src/features/session-player/tests/SessionPlayer.test.tsx`.
2. Run the complete `pnpm test`, `pnpm lint`, `pnpm format:check`, and `pnpm build` commands.
3. In a fresh Chromium profile, verify Start session with autoplay not yet granted and confirm Session content appears before audio readiness.
4. On an iOS/iPadOS Home Screen PWA, verify Start session, background/foreground, explicit Resume, Retry audio, Stop session, and a second Session.
5. On current Safari and Chromium desktop, simulate an audio-device interruption where possible and confirm the Countdown continues while audio reports recovery or failure.
6. Inspect the browser's Web Audio tooling across repeated Start/Exit cycles and confirm retired contexts are closed rather than accumulated.

## Definition of Done

- No Web Audio promise can delay Session Runner startup or Session rendering.
- Start session, Resume, and Retry begin activation from their user gestures.
- Every audio scheduling method reports failure unless its current context is actually running.
- A stuck activation reaches a recoverable UI state in bounded time.
- Recovery resumes only the current audible behavior and never replays stale events.
- Every retired Session context is closed, stale async work is ignored, and repeated teardown is safe.
- Focused regression tests cover H-02 and every lifecycle path named in H-03.

## Documentation

- `docs/files.json` already inventories `docs/` as the cohesive location for plans, so this added plan needs no separate inventory entry.
- If implementation introduces a user-visible term beyond the established Session, Resume, Metronome, Beat, Warning cue, Countdown, and Elapsed time vocabulary, update `docs/UBIQUITOUS_LANGUAGE.md` in the same change.
- Record deviations and real-device findings in the implementation report after remediation.
