# Accept PWA updates from the editor after saving

Forcing a reload can discard Routine edits or an active Session, while a prompt-mode worker without an activation path leaves long-open clients on old releases. Keep prompt mode and check for updates after registration and hourly while the app remains open. Visibility changes do not trigger checks.

Offer update acceptance only from the Routine Editor. An active Session has no update notice; returning to the editor exposes a pending update. Acceptance flushes pending Routine edits before activating the waiting service worker and requesting reload. If the flush fails, activation is aborted and the notice remains available. This preserves a deliberate update point without requiring active Session persistence; Session restoration after arbitrary reload or process discard is a separate unresolved proposal.

Implementation:

- [PWA build configuration](../../vite.config.ts), [registration lifecycle](../../src/services/platform/RegistrationContext.tsx), [editor integration](../../src/features/routine-editor/RoutineEditor/RoutineEditor.tsx), and [update acceptance](../../src/components/AppUpdateBanner/AppUpdateBanner.tsx).
- [Registration tests](../../src/services/platform/RegistrationContext.test.tsx) and [update callback tests](../../src/components/AppUpdateBanner/AppUpdateBanner.test.tsx).
