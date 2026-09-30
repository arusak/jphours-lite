# Keep manual navigation policy in the Session reducer

The Session reducer owns plan order, Current phase, status, and active elapsed time, so it decides navigation targets. Session Runner cancels replaced scheduling and starts new scheduling only while running; UI callers dispatch intent. This keeps navigation rules consistent and avoids caller-specific Resume or threshold calculations.

During a Step, Rewind selects the preceding Step below three active seconds and restarts the Current step at or above three seconds. The first Step always restarts. During Quick Rest, Rewind restarts the Exercise immediately preceding that rest regardless of elapsed time. Manual Finish step and Skip Quick Rest advance directly to the next Step, bypassing Quick Rest. Navigation preserves Pause or interruption and starts the target from its beginning.

Automatic timed Completion may enter Quick Rest and emits Completion cues; manual navigation emits no Completion cues, including at the final Step. Keeping manual and automatic command paths separate preserves that distinction. Navigation also invalidates Stale events and resets Warning eligibility. The three-second threshold is an accepted product rule; the source documents do not explain why that exact value was selected.

Implementation:

- [Reducer](../../src/services/session/sessionReducer.ts), [Session Runner](../../src/services/session/SessionRunner.ts), and [cue adapter](../../src/features/session-player/hooks/useSessionPlayer.ts).
- [Navigation tests](../../src/services/session/session.test.ts), including the regression for Quick Rest after the second Exercise in running, paused, and interrupted states. Commit `45ea119` corrects the extra backward jump found during this ADR review.
