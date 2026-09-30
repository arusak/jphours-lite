# Keep Session progression independent of audio readiness

Browser audio activation can reject or remain pending. Session start and Resume therefore advance the Session Runner without awaiting audio activation. Activation begins from user gestures, and audio exposes readiness and Retry separately so unavailable sound does not prevent timing or navigation.

Audio recovery is bounded and permits one context replacement per activation attempt. Context generations and Current phase keys prevent late work from retired contexts or replaced phases from taking effect. Recovery reconciles only the currently running paced Exercise and any still-future eligible Warning cue; it does not replay missed Beats or cues. Teardown stops scheduled sources, removes listeners, and closes retired contexts.

Losing foreground status interrupts the Session, preserving timing until explicit Resume. This avoids silently continuing practice after the practitioner leaves the app. Audio recovery and Session progression have separate lifecycles; real-device audio interruption behavior still requires release verification.

Implementation:

- [Gesture activation](../../src/app/App.tsx), [Session/audio coordination](../../src/features/session-player/hooks/useSessionPlayer.ts), and [audio lifecycle](../../src/services/audio/AudioController.ts).
- [Audio lifecycle tests](../../src/services/audio/__tests__/AudioController.test.ts) and [Session Player tests](../../src/features/session-player/tests/SessionPlayer.test.tsx).
