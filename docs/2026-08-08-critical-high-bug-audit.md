# Critical and High-Priority Bug Audit

Date: 2026-08-08

## Scope and method

This audit covers the React/TypeScript application, session timing and audio services, browser-lifecycle adapters, local persistence, Vite/PWA configuration, public application icons, and the generated production PWA artifacts. The compatibility target is current evergreen browsers in 2026 and later; optional platform features should degrade safely when unavailable.

Only issues with plausible critical or high impact are in scope: application startup failure, loss or corruption of user data, broken core practice-session behavior, missing audio, failure of offline launch or updates, and failure to keep the screen awake during an active session. Cosmetic differences and optional PWA enhancements are excluded unless they block a core flow.

The method combined static control-flow review with `pnpm build` and inspection of `dist/index.html`, `dist/manifest.webmanifest`, `dist/registerSW.js`, and `dist/sw.js`. Platform claims were checked against standards and first-party browser/tool documentation. No physical iOS/Android device run or browser automation run was available, so the report distinguishes confirmed code paths from device-validation needs.

## Executive summary

No Critical defects were found. Six High-priority findings should be addressed before treating the app as production-ready on the stated browser/PWA target.

| ID   | Severity | Confidence | Finding                                                                                                                                         |
| ---- | -------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| H-01 | High     | Certain    | The default paced timed Exercise has no visible Countdown.                                                                                      |
| H-02 | High     | High       | A pending Web Audio unlock leaves the Session screen completely blank.                                                                          |
| H-03 | High     | High       | Web Audio is not reactivated after interruption, and Session teardown leaks its `AudioContext`.                                                 |
| H-04 | High     | Certain    | Wake Lock ownership fails in both directions: it cannot reacquire a released lock and can retain a lock after Completion.                       |
| H-05 | High     | Certain    | Standards-permitted Web Storage failures can crash startup, block Start session, or silently lose changes.                                      |
| H-06 | High     | Certain    | PWA prompt-update mode has no prompt or activation path, leaving clients indefinitely on an old release while a controlled window remains open. |

The existing unit suite does not cover these paths. Small, temporary Vitest probes were used during the audit and removed afterward: they reproduced the missing visible Countdown, an empty Session while `AudioContext.resume()` remained pending, absence of audio re-unlock on Resume, stale Wake Lock reuse, uncontained `QuotaExceededError`, and loss of an active Session on reload. Static production-artifact probes separately confirmed the missing service-worker update client and unclosed audio context.

## Compatibility baseline / primary sources

### Web app manifest and installation

- Manifest URLs are not independent labels: `start_url` is resolved against the manifest URL and must remain same-origin, while `scope` falls back from `start_url` and an explicit scope is ignored when it does not contain that start URL. Icon `purpose` constrains where a user agent should use an image, and maskable artwork needs to keep important content inside the specified safe zone. See the W3C Web Application Manifest definitions for [`start_url`](https://www.w3.org/TR/appmanifest/#start_url-member), [`scope`](https://www.w3.org/TR/appmanifest/#scope-member), [manifest image resources](https://www.w3.org/TR/appmanifest/#manifest-image-resources), and [maskable icons](https://www.w3.org/TR/appmanifest/#icon-masks).
- Chromium's documented manifest baseline includes 192×192 and 512×512 icons. The generated manifest contains both PNG sizes, plus SVG `any` and `maskable` entries. See Google's first-party guide, [Add a web app manifest](https://web.dev/articles/add-manifest).
- Safari 26 on iOS/iPadOS lets the user add any website as a web app, but still applies supplied manifest metadata and icons; Safari 26 also added SVG icon support. Thus a manifest remains valuable even though Safari's installation UI no longer uses Chromium-style installability gates. See WebKit's [Safari 26 web-app and SVG-icon notes](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/). For compatibility with earlier Safari behavior, WebKit documents that a manifest icon is considered when its purpose is omitted or includes `any`, and that `apple-touch-icon` takes precedence when supplied; see [New WebKit Features in Safari 15.4](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/).
- In Firefox's 2026 platform matrix, built-in web-app installation is available on Windows from Firefox 143, with a later threshold for Microsoft Store builds, but not on macOS or Linux. Offline/service-worker support and in-browser use should therefore remain first-class rather than assuming every desktop browser exposes installation. See Mozilla's [Use web apps in Firefox for Windows](https://support.mozilla.org/en-US/kb/web-apps-firefox-windows).
- Production install/offline behavior still depends on deployment: the service worker requires a potentially trustworthy context, and the generated manifest must be served with an appropriate manifest media type. See the Service Workers specification's [secure-context exposure](https://www.w3.org/TR/service-workers/#service-worker-container) and the plugin's [PWA minimal requirements](https://vite-pwa-org.netlify.app/guide/pwa-minimal-requirements).

### Service-worker scope, navigation fallback, and updates

- A service worker's default scope is the directory containing its script, and only clients within the registration scope are controlled. The generated build consistently registers `/jphours-lite/sw.js` with `/jphours-lite/` scope. See the Service Workers [registration algorithm and default-scope rule](https://www.w3.org/TR/service-workers/#start-register-algorithm).
- Workbox requires `navigateFallback` to name an HTML document present in the precache. The production worker precaches `index.html` under its `/jphours-lite/` scope and binds navigation fallback to `/jphours-lite/index.html`, so the configured subpath is internally consistent. See the Workbox [`navigateFallback` contract](https://developer.chrome.com/docs/workbox/modules/workbox-build#type-GeneratePartial).
- An installed replacement worker normally waits while an existing worker still controls clients; activation occurs once no client uses the old registration unless `skipWaiting()` is deliberately requested. A safe immediate-update flow must also coordinate the page reload and protect unsaved/transient state. See the Service Workers [activation conditions](https://www.w3.org/TR/service-workers/#try-activate-algorithm) and Workbox's [update-handling guidance](https://developer.chrome.com/docs/workbox/handling-service-worker-updates).
- `vite-plugin-pwa`'s `registerType: 'prompt'` does not create a visible prompt by itself. Its documented prompt flow requires importing a registration virtual module, rendering update/offline-ready UI from its callbacks/state, and invoking the returned updater after user acceptance. The plugin can inject a basic registration script when no virtual module is imported, but that script only registers the worker. See the plugin's first-party [prompt-for-update](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html) and [service-worker registration](https://vite-pwa-org.netlify.app/guide/register-service-worker) guides.

### Screen Wake Lock and page lifecycle

- Screen Wake Lock is a secure-context, visible-document capability. The user agent may release it at any time for power or system policy, and it releases all sentinels when the document becomes hidden. `WakeLockSentinel` exposes both `released` and a `release` event so an application can discard a stale handle and reacquire when appropriate. See the Screen Wake Lock specification's [`WakeLockSentinel` interface](https://w3c.github.io/screen-wake-lock/#the-wakelocksentinel-interface), [automatic release rules](https://w3c.github.io/screen-wake-lock/#auto-releasing-wake-locks), and [visibility handling](https://w3c.github.io/screen-wake-lock/#handling-document-loss-of-visibility).
- Screen Wake Lock support was extended to Home Screen web apps on iOS/iPadOS 18.4, so it is part of the 2026 Safari baseline, subject to feature detection and release handling. See WebKit's [Safari 18.4 release article](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/).
- `visibilitychange` accurately exposes the document's visible/hidden state, but on mobile the transition to hidden is often the last reliably observable point before a page is frozen, discarded, or terminated. Core resumable state should be persisted by that transition; discard itself may produce no event. See the W3C [Page Visibility specification](https://w3c.github.io/page-visibility/#reacting-to-visibilitychange) and Chrome's first-party [Page Lifecycle guidance](https://developer.chrome.com/docs/web-platform/page-lifecycle-api).

### Web Audio activation and resumption

- A user agent may keep an `AudioContext` suspended until it is allowed to start, including gating that transition on prior user activation. `resume()` remains pending when the context is not allowed to start. See the Web Audio specification's [allowed-to-start rule and `resume()` algorithm](https://www.w3.org/TR/webaudio/#allowed-to-start).
- Chromium explicitly recommends creating or resuming the context after user interaction and checking the resulting context state rather than assuming sound started. This must be exercised with a fresh browser profile and on Safari/iOS because prior engagement or installation can mask an activation bug. See Chrome's [Autoplay policy and Web Audio guidance](https://developer.chrome.com/blog/autoplay/#web_audio).

### Local persistence

- Accessing `window.localStorage` may throw `SecurityError` when persistence is disallowed by user-agent policy, while `Storage.setItem()` must throw `QuotaExceededError` when a value cannot be stored. Both construction/access and writes therefore need an error boundary or an explicit in-memory fallback. See the WHATWG HTML definitions for [`localStorage`](https://html.spec.whatwg.org/multipage/webstorage.html#dom-localstorage-dev) and [`Storage.setItem()`](https://html.spec.whatwg.org/multipage/webstorage.html#dom-storage-setitem-dev).

## High-priority findings

### H-01 — The default paced timed Exercise has no visible Countdown

**Affected code:** `src/domain/routine.ts:39-46`, `src/features/session-player/SessionPlayer/SessionPlayer.tsx:117-130`, `src/features/session-player/SessionTimer/SessionTimer.tsx:30-66`.

**Evidence and reproduction:** A new Routine defaults to Tempo 80 and Duration 300 seconds, so its first Exercise is paced and timed. `SessionPlayer` correctly calculates and passes `displaySeconds`. `SessionTimer` also formats that value, but its `tempo !== null` branch renders only the Tempo controls; the clock is rendered exclusively by the unpaced branch. Starting the untouched default Routine therefore shows `80 BPM` and a progress ring but no `m:ss` Countdown. A focused DOM probe found the remaining time only in the ring's accessible name and no visible clock text.

The same branch hides Elapsed time for paced open-ended Exercises. This contradicts the domain rule that every Timed step has a Countdown and every Open-ended step has Elapsed time. It affects the default path, not an edge configuration.

**Impact:** The primary timer value is unavailable to sighted users during the app's most common Session mode. Users cannot tell how much time remains except by estimating the ring.

**Suggested solution:** Make time presentation independent of Tempo presentation. Render a visible Countdown for paced timed Exercises and visible Elapsed time for paced open-ended Exercises, with Tempo as a secondary control. Add focused tests for all four Exercise modes; the paced cases must assert both the visible time and BPM where applicable. Use a fake clock so exact values are deterministic.

### H-02 — A pending Web Audio unlock leaves the Session screen blank

**Affected code:** `src/services/audio/AudioController.ts:43-52`, `src/features/session-player/hooks/useSessionPlayer.ts:76-84`, `src/features/session-player/SessionPlayer/SessionPlayer.tsx:55-64`.

**Evidence and reproduction:** Session startup is placed in `.finally()` after `audio.unlock()`. A `finally` callback runs only after the original promise settles. The Web Audio specification allows `resume()` to remain pending while a context is not allowed to start. In that state the Session Runner never starts, `currentStepIndex` stays `null`, and `SessionPlayer` returns `null`; the user sees a blank app rather than a working timer with an audio warning. A deterministic probe using an unresolved unlock promise still found only an empty `<div>` after 150 ms.

This is not merely theoretical for the target platform. A current first-party [WebKit report for Home Screen PWAs on iOS 26](https://bugs.webkit.org/show_bug.cgi?id=291892) documents `AudioContext.resume()` remaining pending even when invoked from a click. Prior engagement can hide this during desktop testing.

**Impact:** Starting a Session can make the entire app appear frozen on a conforming or affected browser. A non-essential capability blocks all timer and control functionality.

**Suggested solution:** Start the Session Runner independently and immediately; audio failure or delay must never gate Session state or rendering. Initiate context creation/resumption directly from the Start session click task where possible, but treat it as a parallel capability. Add a bounded recovery path and an explicit Retry audio action for stuck contexts. Tests should cover resolving, rejecting, throwing, and never-settling unlock operations and assert that the first Step and controls always render.

### H-03 — Web Audio is not reactivated after interruption, and teardown leaks contexts

**Affected code:** `src/features/session-player/hooks/useSessionPlayer.ts:33-84,117-118`, `src/services/audio/AudioController.ts:55-65,138-144,207-210`, `src/services/session/SessionRunner.ts:118-130`.

**Evidence and reproduction:** `audio.unlock()` is called only on initial mount. Backgrounding interrupts the Session and stops the Metronome. When the user taps Resume, the handler calls only `runner.resume()`. The subsequent `onStepStart` calls `startMetronome()`, which schedules nodes against the existing context without checking or resuming its state. A focused lifecycle probe simulated hidden → interrupted → Resume and observed one unlock call total rather than a second call from the Resume gesture.

WebKit has documented iOS cases where Web Audio becomes interrupted or stops progressing after background/foreground transitions; see [WebKit bug 276016](https://bugs.webkit.org/show_bug.cgi?id=276016) and [WebKit bug 263627](https://bugs.webkit.org/show_bug.cgi?id=263627). The app also creates a new controller per Session but `dispose()` never calls `AudioContext.close()`. The Web Audio specification notes that real-time contexts hold expensive system resources, implementations may impose a maximum, and `close()` releases those resources; see [Web Audio 1.1 system-resource guidance](https://www.w3.org/TR/webaudio-1.1/#system-resources-associated-with-baseaudiocontext-subclasses).

**Impact:** After switching apps, locking the phone, or taking an interruption, the Countdown may resume while the Metronome and all cues remain silent. Repeated Start/Exit cycles can compound the failure by accumulating contexts until the browser refuses or cannot service another one.

**Suggested solution:** Treat audio as an explicit lifecycle state. From the Resume button's user gesture, call an `ensureRunning()` operation before or alongside `runner.resume()` without blocking the timer; observe `statechange`, verify `context.state === 'running'`, and report failure instead of returning success after merely scheduling nodes. Account defensively for WebKit's non-standard `interrupted` state and recreate a context when a bounded resume attempt stays stuck. On disposal, idempotently stop sources, disconnect nodes, call `context.close()`, and clear the reference. Add tests for running → suspended/interrupted → Resume, stuck resume recovery, and close-on-dispose/double-dispose.

### H-04 — Wake Lock ownership is broken after backgrounding and Completion

**Affected code:** `src/services/platform/wakeLock.ts:1-27`, `src/features/session-player/hooks/useSessionPlayer.ts:59-70,76-84`, `src/features/session-player/SessionPlayer/SessionPlayer.tsx:55-62`.

**Evidence and reproduction:** The controller's handle type includes only `release()`, omitting the standard `released` property and `release` event. `acquire()` returns whenever the stored object is non-null. Browsers must release a screen lock when the document becomes hidden and may revoke it for power policy; the released sentinel cannot be reused. The visibility handler nevertheless retains that stale object, so its visible-path `acquire()` becomes a no-op. A deterministic sentinel-release probe dispatched `release`, called `acquire()` again, and observed one browser request instead of two.

Ownership also fails in the opposite direction. The hook releases only during unmount. Automatic Session Completion renders `EndScreen` without unmounting `useSessionPlayer`, so a granted lock can keep the display awake until the user explicitly returns to the Routine. Manual Pause likewise retains it.

**Impact:** After the first app switch or OS revocation, the screen may dim or lock mid-practice despite Wake Lock support. Conversely, after Completion or Pause the PWA can keep a phone awake indefinitely, wasting battery.

**Suggested solution:** Model the full sentinel contract, clear the current handle on its `release` event, check `released` before the early return, and protect against an old sentinel's late event clearing a newer lock. Derive ownership from state: acquire only while the Session is `running` and the document is visible; release for `paused`, `interrupted`, `completed`, `stopped`, hidden, and unmount. Test UA auto-release/reacquire, hidden → visible → Resume, late-event races, Completion, and denial.

### H-05 — Web Storage failures can crash or disable core flows

**Affected code:** `src/app/App.tsx:9-28`, `src/services/persistence/routine-repository.ts:43-57`, `src/services/persistence/debounced-routine-saver.ts:13-28`, `src/features/routine-editor/RoutineEditor/RoutineEditor.tsx:67-74`.

**Evidence and reproduction:** The repository's default constructor argument evaluates `window.localStorage` during `App` render, outside the `load()` try/catch. The HTML Standard explicitly permits that getter to throw `SecurityError`. In that case no UI renders. Writes are also unguarded even though `setItem()` must throw `QuotaExceededError` when storage is full. A fake standards-compliant storage object reproduced the uncaught exception. Because Start session calls `editor.flush()` before `onStartSession`, a write failure can prevent the Session from starting; background debounced failures otherwise leave users believing changes were saved when they were not.

**Impact:** Privacy policy, an opaque/embedded origin, or quota pressure can turn a recoverable lack of persistence into total startup failure, a blocked Session, or silent Routine data loss.

**Suggested solution:** Resolve browser storage lazily inside a guarded adapter and fall back to an in-memory repository so the timer remains usable. Make `save()` return a typed success/failure result; keep the latest unsaved Routine in memory and show a persistent, actionable “changes will not survive reload” status. Starting a Session must not depend on persistence succeeding. Test a throwing `localStorage` getter, read denial, quota failure during debounce, quota failure during Start session, and later recovery.

### H-06 — PWA updates have no prompt or activation path

**Affected code:** `vite.config.ts:14-15`, `src/main.tsx:1-10`, and generated `dist/registerSW.js` / `dist/sw.js`.

**Evidence and reproduction:** The PWA plugin is configured with `registerType: 'prompt'`, but application code never imports `virtual:pwa-register` or `virtual:pwa-register/react`, never handles `onNeedRefresh`, and never calls `updateServiceWorker`. The production `registerSW.js` only registers the worker. The generated worker listens for a `SKIP_WAITING` message, but no client sends it. Under the standard lifecycle, a replacement worker therefore remains waiting while the old worker controls any client; ordinary reload is still controlled by the old worker. A production-build probe confirmed there is no prompt callback, waiting-worker report, or activation message path.

**Impact:** An installed PWA or forgotten browser tab can continue serving an old precached HTML/JavaScript release for days, including after critical bug fixes are deployed. The configured behavior advertises a prompt that users can never receive.

**Suggested solution:** Keep prompt mode because forced reload can destroy editor or active Session state. Add a top-level update component using `virtual:pwa-register/react`, show `needRefresh` and offline-ready state, and call `updateServiceWorker(true)` only after acceptance. For long-open standalone windows, periodically call `registration.update()`. Add a production-preview browser test that installs v1, serves v2, observes the prompt, accepts it, and verifies the new controller/build. Persist any active Session before allowing reload.

## Verified PWA/build positives

- `pnpm test`: 9 files, 42 tests passed before the temporary audit probes were added.
- `pnpm build`: passed; Vite generated a service worker precaching nine shell assets.
- `pnpm lint` and `pnpm format:check`: passed.
- The emitted manifest's `/jphours-lite/` `start_url` and `scope`, the service-worker registration scope, and the navigation fallback agree.
- The emitted manifest includes 192×192 and 512×512 PNG icons, and the generated worker precaches the HTML, hashed JavaScript/CSS, manifest, and icons.

## Release validation matrix

After remediation, exercise at least these real-browser paths:

1. iOS/iPadOS 26 Home Screen PWA: first launch, relaunch, Start session, background/foreground, Resume, screen lock, audio interruption, Completion, and offline cold launch.
2. Android Chromium installed PWA: Wake Lock denial/revocation, long-running Session, v1 → v2 update prompt/acceptance, offline relaunch, and storage quota failure.
3. Current Safari, Chromium, and Firefox desktop: all four Exercise modes, storage disabled, multiple sequential Sessions, open controlled tab during an update, keyboard controls, and offline reload.

Active Session recovery after process discard was reproducibly absent, but it is not scored above because the current product model does not explicitly require reload restoration. For a mobile PWA with potentially long Sessions, decide this before release: persist a versioned interrupted-Session snapshot containing the captured plan and relative remaining/elapsed values, restore it as `interrupted`, and clear it on Stop or Completion. Do not persist absolute `performance.now()` timestamps across document lifetimes.
