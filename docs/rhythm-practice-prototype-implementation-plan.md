# Rhythm Practice Trainer — Prototype Implementation Plan

**Prototype objective:** Validate the complete routine-building and guided-session experience as an installable, offline-capable PWA.

The prototype deliberately excludes accounts, cloud storage, microphone input, performance analysis, and statistics.

## 1. Prototype behaviour

The user can create an ordered list of exercises. Every exercise contains:

- a required plain-text title;
- an optional BPM value;
- an optional duration.

The user also configures one break duration used between exercises.

### Supported exercise combinations

| Title | BPM | Duration | Valid | Runtime behaviour |
|---|---:|---:|---:|---|
| Required | Set | Set | Yes | Metronome plus countdown |
| Required | Empty | Set | Yes | Countdown without metronome |
| Required | Empty | Empty | Yes | Manual, open-ended task |
| Required | Set | Empty | No | Rejected in the prototype |

Every active exercise has an **End/Skip exercise** button. The session itself has Pause/Resume and Stop controls.

Timed exercises:

- play a warning 20 seconds before completion when their duration is longer than 20 seconds;
- play a completion cue;
- advance to the next break or complete the session.

Open-ended exercises:

- run without a metronome;
- do not play a warning;
- do not complete automatically;
- advance only after the user presses End/Skip exercise.

Breaks:

- appear between exercises;
- stop the metronome;
- display a countdown;
- play an end-of-break cue;
- can be skipped;
- automatically start the next exercise.

## 2. Prototype acceptance criteria

The prototype is successful when all of the following work on desktop and at least one Android and one iOS device:

1. A user can add at least 20 exercises without loss of data.
2. Exercises can be renamed, deleted, and reordered.
3. Exercise mode is derived correctly from BPM and duration.
4. Invalid BPM-without-duration input is clearly rejected.
5. A saved routine survives reload and offline reopening.
6. Starting a session begins the correct first task.
7. A paced task plays a stable metronome at the configured BPM.
8. A timed task displays an accurate remaining-time value.
9. The 20-second warning plays once and only once.
10. End/Skip immediately stops the current metronome and timer.
11. Breaks appear only between exercises and use the configured duration.
12. Pause freezes session progression and stops newly scheduled clicks.
13. Resume continues the correct exercise or break.
14. Stop ends the entire session and clears all scheduled audio.
15. Open-ended exercises never auto-complete.
16. The final exercise ends without creating a trailing break.
17. The application can be installed as a PWA.
18. The routine editor works offline after the application has been cached.
19. Returning from an interruption never creates two simultaneous metronomes or duplicate timers.
20. The active-session screen remains usable on a small phone in portrait orientation.

## 3. Recommended technical stack

### Application

- **TypeScript**
- **React**
- **Vite**
- **vite-plugin-pwa** or an equivalent Workbox-based Vite integration

### State

Use two distinct state areas:

- **persisted routine state** for exercises and settings;
- **transient session state** for the currently running session.

A small Zustand store is suitable, but the session transition logic should live in a reducer or dedicated Session Runner rather than being spread across UI actions.

### Audio

- Web Audio API;
- generated oscillator clicks or small bundled click samples;
- one shared `AudioContext`;
- look-ahead beat scheduling against `AudioContext.currentTime`;
- separate gain nodes for metronome and cue volume.

### Persistence

- `localStorage` for the prototype;
- versioned serialized routine schema;
- repository interface around browser storage so IndexedDB can replace it later.

### Testing

- Vitest for unit and integration tests;
- React Testing Library for editor and player behaviour;
- Playwright for the primary browser flow;
- manual real-device tests for audio, lifecycle, installation, and wake lock.

## 4. Proposed source structure

```text
src/
  app/
    App.tsx
    routes.ts

  domain/
    routine.ts
    exercise.ts
    session.ts
    validation.ts

  features/
    routine-editor/
      RoutineEditor.tsx
      ExerciseRow.tsx
      routineEditorStore.ts

    session-player/
      SessionPlayer.tsx
      SessionSummary.tsx
      useSessionRunner.ts

  services/
    session/
      SessionRunner.ts
      sessionReducer.ts
      buildSessionSteps.ts

    audio/
      AudioController.ts
      MetronomeEngine.ts
      CuePlayer.ts
      clickScheduler.ts

    timing/
      CountdownClock.ts

    persistence/
      RoutineRepository.ts
      LocalStorageRoutineRepository.ts
      migrations.ts

    platform/
      wakeLock.ts
      visibilityLifecycle.ts

  pwa/
    registerServiceWorker.ts
    updateFlow.ts

  test/
    fakes/
      FakeAudioClock.ts
      FakeCountdownClock.ts
```

The exact folder names are flexible. The important separation is:

- domain rules do not depend on React;
- the Session Runner does not depend on visible components;
- audio scheduling is not implemented inside React effects;
- browser persistence is behind a repository;
- platform lifecycle handling is isolated.

## 5. Initial domain model

```ts
export interface Routine {
  schemaVersion: 1;
  id: string;
  name: string;
  exercises: Exercise[];
  defaultBreakDurationSec: number;
  warningLeadTimeSec: number;
  autoAdvance: true;
  updatedAt: string;
}

export interface Exercise {
  id: string;
  title: string;
  tempoBpm: number | null;
  durationSec: number | null;
}

export type ExerciseMode =
  | "paced-timed"
  | "free-timed"
  | "open-ended";

export type SessionStep = ExerciseStep | BreakStep;

export interface ExerciseStep {
  id: string;
  kind: "exercise";
  sourceExerciseId: string;
  title: string;
  mode: ExerciseMode;
  tempoBpm: number | null;
  durationSec: number | null;
}

export interface BreakStep {
  id: string;
  kind: "break";
  durationSec: number;
  afterExerciseId: string;
}
```

### Suggested validation ranges

These are prototype defaults and should be constants:

- title: 1–200 characters after trimming;
- BPM: 20–300;
- timed exercise duration: 1 second to 120 minutes;
- break duration: 0 seconds to 30 minutes;
- warning lead: fixed at 20 seconds in the UI;
- exercise count: no artificial limit below 100.

A zero-second break means that no break step is generated.

## 6. Session step generation

When the user starts a session, create an immutable snapshot of executable steps.

```text
Exercise 1
Break
Exercise 2
Break
Exercise 3
```

Rules:

1. Preserve the editor order.
2. Add a break after every exercise except the last.
3. Do not add breaks when the configured duration is zero.
4. Derive and store the exercise mode in each exercise step.
5. Do not observe later editor changes during the running session.
6. Reject session start when the routine is empty or invalid.

This snapshot prevents unexpected behaviour if the persisted routine changes during a session.

## 7. Session Runner design

The Session Runner owns all runtime transitions.

### Commands

```ts
type SessionCommand =
  | { type: "START"; routine: Routine }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "SKIP_STEP" }
  | { type: "STOP" }
  | { type: "STEP_WARNING"; stepId: string }
  | { type: "STEP_COMPLETED"; stepId: string }
  | { type: "APP_HIDDEN" }
  | { type: "APP_VISIBLE" };
```

### State

```ts
type SessionStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "stopped"
  | "interrupted";

interface SessionState {
  status: SessionStatus;
  steps: SessionStep[];
  currentStepIndex: number | null;
  currentStepStartedAt: number | null;
  currentStepEndsAt: number | null;
  pausedRemainingSec: number | null;
  warningPlayedForStepId: string | null;
}
```

### Responsibilities

On entry to an exercise step:

- paced timed: start metronome and countdown;
- free timed: start countdown only;
- open-ended: start neither timer nor metronome;
- expose step details to the UI.

On entry to a break:

- stop metronome;
- start break countdown;
- expose the next exercise to the UI.

On every exit from a step:

- cancel scheduled callbacks;
- stop metronome scheduling;
- prevent stale completion events from affecting the new step;
- move to the next step or complete the session.

Every asynchronous timer event must carry the step ID that created it. The runner ignores an event whose step ID is no longer current.

## 8. Metronome implementation

Do not use `setInterval(60000 / bpm)` as the beat source. Browser timers can be delayed by rendering, garbage collection, and lifecycle throttling.

Use a look-ahead scheduler:

1. Read `AudioContext.currentTime`.
2. Keep `nextBeatTime` in audio-clock seconds.
3. Run a lightweight scheduler periodically.
4. Schedule all beats within a short future window.
5. Increment `nextBeatTime` by `60 / bpm`.
6. Stop scheduling immediately when the runner pauses, skips, or stops.

Conceptual settings:

```ts
const schedulerPollMs = 25;
const scheduleAheadSec = 0.1;
```

These are starting values, not product requirements. They should be tested on real devices.

### Prototype click

The fastest implementation is a short oscillator pulse through a gain envelope. Bundled audio samples can be added later if the generated click is unpleasant or inconsistent across devices.

### Visual beat indication

The visual pulse is secondary. It may be triggered from scheduled beat metadata, but visual rendering must never control audio timing.

## 9. Countdown implementation

For a timed step, calculate:

```ts
endsAt = monotonicNow() + durationSec * 1000;
```

The displayed remaining time is derived from `endsAt - monotonicNow()`.

Do not decrement an integer once each second. Derivation from a target timestamp avoids cumulative drift.

### Warning scheduling

For a step longer than 20 seconds:

```ts
warningAt = endsAt - 20_000;
```

The warning must be idempotent. Store that it has been emitted for the current step.

### Pause and resume

On pause:

- calculate and store remaining duration;
- cancel warning and completion callbacks;
- stop metronome scheduling;
- retain the current step.

On resume:

- create a new `endsAt` from the stored remaining duration;
- reschedule warning only if it has not already played;
- restart the metronome from a new beat boundary;
- do not attempt to reconstruct beats that would have occurred while paused.

## 10. Audio cues

Use recognizably different sounds for:

- pre-end warning;
- exercise completion;
- break completion / next exercise start;
- complete session.

The prototype may use generated tones with different pitch patterns. Keep cue playback independent from the metronome gain so the user can later configure their volumes separately.

Audio should be unlocked as part of the explicit **Start session** user gesture. Do not wait until the first warning to initialize it.

## 11. Routine Editor UI

### Minimum controls

At routine level:

- routine name, optional for prototype;
- default break duration;
- Add exercise;
- Start session.

For every exercise row:

- title text input;
- BPM numeric input;
- duration minutes and seconds, or one duration control with unit support;
- derived mode label;
- Move up;
- Move down;
- Delete.

Drag-and-drop reordering is optional. Up/down controls are faster to implement, accessible, and adequate for validating the workflow.

### Editor validation

Validation should be immediate and local to the affected row.

Examples:

- blank title: “Enter an exercise name.”
- BPM without duration: “A metronome exercise needs a duration.”
- invalid BPM: “Use a tempo from 20 to 300 BPM.”
- invalid duration: “Enter a positive duration.”

Disable Start session while the routine is invalid.

### Persistence behaviour

Persist after a short debounce or after each committed field change. Flush pending changes when the page becomes hidden.

## 12. Session Player UI

The active session should be a dedicated view.

### Primary display

- exercise or break title;
- mode;
- BPM when applicable;
- large remaining time when applicable;
- elapsed time for open-ended exercises;
- progress such as “Exercise 2 of 6”;
- next exercise title;
- visual metronome pulse, optional.

### Primary controls

- Pause / Resume;
- End/Skip exercise or Skip break;
- Stop session.

Use large touch targets and ensure that accidental Stop is less likely than Pause or End/Skip. A lightweight confirmation for Stop is acceptable; no confirmation is needed for End/Skip.

### Behaviour while paused

- all audio stops;
- remaining time stays fixed;
- current task remains visible;
- only Resume and Stop are primary actions.

## 13. PWA and lifecycle behaviour

### PWA requirements

- web app manifest;
- installable icons;
- standalone display mode;
- cached application shell;
- cached click and cue assets, if samples are used;
- offline startup;
- clear update flow that does not reload during an active session.

### Screen wake lock

Request a screen wake lock when the session starts and release it when the session ends. Re-request it when the page becomes visible again because a lock may be released by the platform.

Treat wake lock as progressive enhancement. The session must continue to work when it is unavailable.

### Visibility and interruption policy

For the prototype, use a conservative foreground-first policy:

- when the app becomes hidden, mark the session as interrupted or automatically pause it;
- stop future metronome scheduling;
- when visible again, require or offer a clear Resume action;
- never assume that background timers or audio remained correct;
- never replay missed clicks.

Automatic pause on hidden is the safer default for validating practice behaviour consistently across platforms.

## 14. Implementation phases

## Phase 0 — Project foundation

Deliverables:

- Vite + React + TypeScript application;
- basic responsive shell;
- formatting, linting, and tests;
- domain types;
- initial PWA manifest;
- empty repository and service interfaces.

Exit condition:

- application runs locally and as a production build;
- test runner and basic Playwright flow work.

## Phase 1 — Routine editor and persistence

Deliverables:

- add, edit, delete, and reorder exercises;
- BPM and duration validation;
- default break input;
- derived exercise modes;
- local-storage repository;
- schema version and migration entry point;
- restore routine after reload.

Exit condition:

- a complete routine can be authored and survives reload;
- invalid configurations cannot start.

## Phase 2 — Audio foundation and metronome

Deliverables:

- shared Audio Controller;
- audio unlock flow;
- generated metronome click;
- BPM scheduler based on the audio clock;
- start, pause, resume, and stop controls in a metronome test screen;
- cue sounds.

Exit condition:

- metronome runs for an extended foreground test without obvious drift or duplicate clicks;
- repeated start/stop cycles do not leak audio scheduling.

## Phase 3 — Session Runner

Deliverables:

- session step generation;
- reducer/state machine;
- timed exercise countdown;
- open-ended exercise handling;
- breaks;
- warning scheduling;
- automatic advancement;
- pause, resume, skip, and stop;
- stale-event protection using step IDs.

Exit condition:

- a mixed routine completes correctly from start to finish without the final break;
- all three exercise modes behave correctly.

## Phase 4 — Session Player UX

Deliverables:

- dedicated player screen;
- current and next exercise presentation;
- remaining and elapsed time displays;
- progress display;
- large mobile controls;
- completion screen;
- accidental-navigation protection during active sessions.

Exit condition:

- a user can operate the session without returning to the editor or interacting with small controls.

## Phase 5 — PWA, offline use, and lifecycle

Deliverables:

- service worker and application-shell caching;
- install flow;
- offline startup;
- wake-lock integration;
- visibility-change handling;
- interrupted-session recovery;
- update deferral while a session is active.

Exit condition:

- installed application can open offline;
- backgrounding and restoring never produces duplicate audio or incorrect automatic advancement.

## Phase 6 — Test hardening and device validation

Deliverables:

- unit tests for mode derivation and validation;
- unit tests for session transitions;
- fake-clock tests for warning and completion boundaries;
- integration tests for audio-service commands;
- Playwright routine-to-completion flow;
- Android and iOS manual test matrix;
- documented PWA limitations and native escalation criteria.

Exit condition:

- acceptance criteria are recorded as passing, failing, or intentionally deferred;
- the PWA/native platform decision is based on real-device evidence.

## 15. Essential automated tests

### Domain tests

- derives paced timed mode;
- derives free timed mode;
- derives open-ended mode;
- rejects tempo without duration;
- does not create a break after the last exercise;
- omits breaks when break duration is zero.

### Session transition tests

- start enters first exercise;
- timed completion enters break;
- skip enters break or completes if last;
- open-ended exercise never completes from a timer event;
- pause preserves remaining time;
- resume reschedules correctly;
- warning fires once;
- stale completion from a previous step is ignored;
- stop clears current step and audio;
- final step completes session.

### UI flow tests

- add a mixed routine;
- reload and restore it;
- start session;
- skip an open-ended exercise;
- pause and resume a timed exercise;
- complete the routine;
- return to editor.

## 16. Manual device test matrix

Test at minimum:

- desktop Chromium;
- desktop Safari;
- Android Chrome installed PWA;
- iPhone Safari and installed Home Screen PWA.

Scenarios:

- 40, 60, 120, and 240 BPM;
- a routine longer than 20 minutes;
- notification interruption;
- incoming call interruption where practical;
- volume changes;
- silent mode;
- Bluetooth headphones;
- wired headphones where available;
- screen wake lock;
- manual screen lock;
- switch to another application and return;
- offline launch;
- application update available during a session.

Record observed behaviour rather than assuming browser parity.

## 17. Prototype risks and mitigations

### Browser audio suspension

**Risk:** Mobile platforms can suspend Web Audio or timers when backgrounded.

**Mitigation:** Foreground-first product rule; auto-pause on hidden; wake lock; explicit resume; native escalation if background operation becomes required.

### Timer drift

**Risk:** Repeated intervals accumulate delay.

**Mitigation:** Audio-clock scheduling for beats and target-timestamp calculation for countdowns.

### Duplicate events after skip or pause

**Risk:** An old timeout completes a step that is no longer current.

**Mitigation:** Cancellable schedules plus step-ID validation in every asynchronous event.

### Silent or blocked first cue

**Risk:** Browser autoplay policy prevents audio that was not initialized by user action.

**Mitigation:** Create/resume the AudioContext during Start session and play a short optional readiness cue.

### PWA update interrupts session

**Risk:** A newly activated service worker reloads the application.

**Mitigation:** Defer update activation while a session is running and offer reload after completion.

### Overbuilt architecture

**Risk:** Preparing for future microphone analysis makes the prototype slow to change.

**Mitigation:** Preserve module boundaries, timestamps, and interfaces, but do not build analysis pipelines, backend schemas, or event sourcing in Version 1.

## 18. Deferred decisions

Do not block the prototype on these choices:

- multiple saved routines;
- count-in before an exercise;
- beat accents and subdivisions;
- per-exercise break duration;
- manual versus automatic start after breaks;
- custom sounds;
- themes;
- cloud synchronization;
- session history;
- microphone permissions and analysis;
- native packaging.

The internal models should leave room for these features, but the first implementation should not expose them.

## 19. Final prototype recommendation

Build the prototype as a **foreground-first React/TypeScript PWA** with:

- local routine persistence;
- one central Session Runner;
- Web Audio look-ahead metronome scheduling;
- timestamp-derived countdowns;
- three supported exercise modes;
- generated break steps;
- automatic progression for timed steps;
- manual completion for open-ended steps;
- conservative pause-on-background lifecycle handling.

Only decide whether to package the app after real-device tests show whether the PWA meets the required reliability level.
