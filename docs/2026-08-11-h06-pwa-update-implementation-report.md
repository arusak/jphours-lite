# H-06 Controlled PWA Update Flow — Implementation Report

Date: 2026-08-11

## Delivered behavior

The application now registers the prompt-mode PWA client with `virtual:pwa-register/react`. It asks the browser to check for an updated service worker after registration and every hour while the application remains open. It deliberately does not check on visibility changes.

When an updated worker is waiting, the update notice is rendered only in the Routine Editor. An active Session never renders the notice; returning from that Session reveals it if the update is still pending. The notice is an in-flow top banner with no dismiss control and no z-index, so it shifts the editor down and existing Bottom Sheet/backdrop layering covers it naturally.

Selecting **Update** flushes pending Routine edits before requesting service-worker activation and reload. If the flush throws, activation is not requested and the banner remains available. The implementation does not show an offline-ready notification.

## Scope notes

No automated tests or release checklist were added, per the agreed H-06 scope. The production build remains the verification for the generated PWA registration and service-worker output.
