# Beat Synchronization: Current Architecture and Future Options

Date: 2026-08-10

Status: The decision was made during the design interview; implementation has not started.

## Why the Current Design Needs to Change

During a **Paced timed exercise** or **Paced open-ended exercise**, several events must follow the same rhythmic grid:

- the audible **Beat**;
- switching between the four beat dots;
- `TimerRing` progress;
- the **Warning cue**;
- future time signatures such as 3/4 and multiple accent levels.

Matching BPM values do not currently guarantee matching phases because these events are calculated by three separate timing mechanisms.

## Current Architecture

### Web Audio

`AudioController` uses `AudioContext.currentTime`. Its scheduler wakes approximately every 25 ms and queues oscillators for the next 100 ms. This is the correct look-ahead approach for Web Audio: sound timing does not depend on React rendering or ordinary JavaScript timer precision.

However, `onBeatScheduled` fires when a sound enters the queue, not when the practitioner hears the Beat. The UI can therefore learn about a Beat almost 100 ms before the sound occurs.

### The Four Beat Dots

`useSessionPlayer` receives `onBeatScheduled`, writes `beat % 4` to React state, and `SessionPlayer` highlights the corresponding dot. The dot currently changes early, uses a 280 ms `beat-pulse` CSS animation, and permanently assumes a four-position cycle.

### Countdown, Elapsed Time, and TimerRing

`SessionRunner` stores Current phase boundaries using `performance.now()` and `setTimeout`. The UI separately updates `now` every 250 ms. That value determines `TimerRing` progress, after which a CSS transition interpolates `stroke-dashoffset` for another 250 ms. The ring has no knowledge of the audio scheduler phase.

### Warning Cue

`SessionRunner` mathematically aligns the Warning cue to the Tempo but does not use the actual audio grid. A live Tempo change restarts the audio grid without recalculating an already scheduled warning timer.

### Live Tempo Changes

Every `+` or `−` press stops the scheduler, cancels queued oscillators, creates a new boundary 50 ms in the future, and immediately schedules a Beat. Repeated presses therefore create repeated artificial Beats. This behavior comes from the restart lifecycle in `AudioController.updateMetronomeTempo`; it is not a Web Audio limitation.

```text
AudioContext clock ──> AudioController ──> audible Beat
                              └──────────> onBeatScheduled ──> dots (early)

performance.now() ──> SessionRunner ──> Completion / Warning cue

performance.now() ──> 250 ms polling ──> React ──> CSS transition ──> TimerRing
```

The underlying problem is not the lack of a reactive API. The application first needs one canonical source of rhythmic phase; an Observable, callback, or store is merely a delivery mechanism.

## Requirements for a Shared Contract

The contract must distinguish:

- `scheduled Beat`: the Beat is already in the audio queue but is not yet audible;
- `audible Beat boundary`: the calculated instant at which the Beat should sound;
- `beatIndex`: a monotonic index within the current Metronome run;
- `positionInPattern`: a position in the Beat pattern, currently `0..3` but not permanently limited to four positions;
- `accent`: the role of the Beat, initially `primary | secondary` but open to more levels;
- `tempo`, `running`, and a generation token used to ignore **Stale events** after Pause, Resume, Stop, or a Current phase change.

Human Beat 2 corresponds to internal `beatIndex = 1`. Lowering the tone by 1.5 whole tones means three semitones: `baseFrequency × 2^(-3/12)`, while retaining the same waveform and decay.

## Option A: A Small BeatClock on Top of Web Audio

`AudioController` remains responsible for precise audio scheduling. A small typed `BeatClock` or `BeatTimeline`:

1. stores the current rhythm snapshot;
2. publishes scheduled boundaries with their `AudioContext` times;
3. delivers UI snapshots at calculated audible boundaries;
4. cancels or ignores callbacks from obsolete generations;
5. exposes `subscribe/getSnapshot`, compatible with React `useSyncExternalStore`.

Advantages:

- one grid for sound and UI;
- no new streaming dependency;
- a small, testable API;
- a natural path toward configurable Beat patterns.

Disadvantages:

- a busy main thread can still render the UI late, although the audio remains precise;
- lifecycle and Stale event handling must be implemented explicitly;
- a custom store may become restrictive if the application later gains many composed streams.

Assessment: selected option.

## Option B: An RxJS Stream

The audio scheduler publishes `beatScheduled`, `beatAudible`, `tempoChanged`, `paused`, and `stopped` as Observables, and consumers combine them with RxJS operators.

Advantages:

- expressive stream composition and established cancellation operators;
- useful for editable patterns, polyrhythms, or many independent consumers.

Disadvantages:

- RxJS does not improve timing precision; `AudioContext` must still be the clock;
- it adds a dependency and a separate mental model;
- it is more complex than the current requirements justify.

Assessment: a possible future evolution, but premature today.

## Option C: A Shared Calculation Based on performance.now()

The dots and ring use a shared formula such as `floor((performance.now() - startedAt) / beatInterval)`, while audio scheduling remains separate.

Advantages: minimal change and no new dependency.

Disadvantages: there are still two clocks, drift relative to audio remains possible, Pause/Resume and live Tempo changes stay difficult, and the model does not extend cleanly to patterns.

Assessment: does not satisfy precise audiovisual synchronization.

## Decisions

1. Use Option A without RxJS.
2. Distinguish `beatIndex`, `positionInPattern`, and `accent` immediately, while deferring user-facing time-signature and accent controls.
3. Keep the initial four-beat pattern. Beats 2 and 4 use the alternate tone with the same waveform and decay and a frequency three semitones lower.
4. Name the setting `Alternate beat tone`, enable it by default, and store it in the Routine. Changes made during an active Session are also saved automatically, matching Metronome sound behavior.
5. Tempo remains a Session override until the practitioner presses the existing Save button.
6. Make the dots 14 px and switch them instantly at audible Beat boundaries without animations or transitions.
7. Advance `TimerRing` discretely at each audible Beat boundary using a 150 ms `ease-out` transition. If Completion occurs between Beats, immediately advance the ring to 100%.
8. Align the Warning cue to the same actual Beat grid.
9. A live Tempo change does not restart the Metronome. The closest already scheduled Beat keeps its original time, the latest Tempo applies to the following interval, and the Beat index and accent sequence do not reset.
10. Changing Alternate Beat tone does not restart the Metronome and applies to the next Beat that has not yet been scheduled.

## Current Implementation Files

- `src/services/audio/AudioController.ts`: look-ahead scheduling and Beat synthesis;
- `src/features/session-player/hooks/useSessionPlayer.ts`: coordination between Session Runner, audio, and React state;
- `src/services/session/SessionRunner.ts`: Current phase boundaries, Completion, and Warning cue;
- `src/features/session-player/SessionPlayer/SessionPlayer.tsx` and `.module.css`: beat dots;
- `src/components/TimerRing/`: ring rendering and transition;
- `src/services/audio/__tests__/AudioController.test.ts` and `src/services/session/session.test.ts`: existing timing coverage.
