# Use Web Audio and BeatClock for rhythmic alignment

Independent audio scheduling and UI rhythm calculations can agree on Tempo while disagreeing on phase. Web Audio therefore schedules Beats using `AudioContext.currentTime`; a small BeatClock publishes snapshots at their calculated audible boundaries. Beat dots, paced TimerRing updates, and paced Warning cues follow this grid. A queued Beat and an audible Beat boundary are distinct events, and generation tokens reject Stale events after lifecycle changes.

The chosen BeatClock avoids an RxJS dependency because stream composition would not improve audio timing precision and exceeds current needs. A separate rhythmic formula based on `performance.now()` was rejected because it retains two independent rhythm clocks. Session Runner still uses its own monotonic clock and timers for progression: this decision aligns rhythmic events, not every Session event. A busy main thread can delay UI publication or rendering even while audio remains precisely scheduled.

A live Tempo change preserves already queued Beats and applies the latest Tempo to the interval after the last queued boundary without resetting Beat index or pattern position. The plan described preserving the closest queued Beat; the implementation and tests retain every Beat already in the audio queue. Sound and Alternate beat tone changes affect unscheduled Beats. The initial pattern has four positions; enabled Alternate beat tone lowers Beats 2 and 4 by three semitones while retaining waveform and decay. Warning cues for paced timed Exercises align to the nearest Beat. Configurable time signatures and accent controls remain deferred.

Implementation:

- [AudioController](../../src/services/audio/AudioController.ts), [BeatClock](../../src/services/audio/BeatClock.ts), and [paced UI consumers](../../src/features/session-player/SessionPlayer/SessionPlayer.tsx).
- [Audio scheduling, live changes, and Warning-grid tests](../../src/services/audio/__tests__/AudioController.test.ts).
