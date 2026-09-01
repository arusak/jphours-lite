# Session Tempo Long Press: Manual Test Guide

Date: 2026-09-01

## Prerequisites

- Run the application with a Routine that contains a paced Exercise with a known saved Tempo, preferably 90 BPM.
- Have mouse, touch (device or browser emulator), and stylus-capable input available where supported.
- Keep audio available for the running-session checks, but be able to Pause the Session.
- Record the saved Tempo before testing so the test data can be restored afterwards.

## Short press and hold behavior

For both **Increase tempo** and **Decrease tempo**:

1. Tap/click and release normally. Expected: Tempo changes exactly once by 1 BPM and Save appears when it differs from the saved value.
2. Press and release before one second. Expected: exactly one 1-BPM change after release; no delayed change follows.
3. Hold through one second. Expected: the first 1-BPM change occurs at about 1,000ms, then one change about every 250ms (4 BPM/s).
4. Release after several repeated changes. Expected: changes stop immediately and there is no extra final 1-BPM change.
5. While holding, move the pointer outside the visual button and then release. Expected: repetition continues while captured and stops on release.

Repeat these checks using a mouse, touch, and stylus when the platform supports each input type.

## Cancellation and bounds

1. Start a hold, then trigger a pointer cancellation if the browser/device tooling permits it. Expected: all pending or repeating changes stop; no subsequent delayed change occurs.
2. Hold Decrease toward 20 BPM. Expected: Tempo stops at 20 BPM, the control remains responsive, and no additional audio updates are caused by continued holding.
3. Hold Increase toward 300 BPM. Expected: Tempo stops at 300 BPM with the same behavior.

## Paused Session and Save behavior

1. Pause a paced Exercise, then long-press either Tempo button. Expected: the displayed Session Tempo changes while the Session remains paused and audio does not restart.
2. Resume. Expected: the selected live Tempo is used by the continuing Session.
3. After any divergent Tempo change, confirm Save is visible. Do not use it initially: navigating away or ending the Session must not persist the temporary override.
4. Change Tempo again and deliberately select Save. Start a later Session for the same Exercise. Expected: the saved Tempo is used.

## Cleanup and browser compatibility

1. Start a hold, then leave the paced Exercise phase before the one-second threshold and again while repeats are active. Expected: the later Current phase receives no delayed or repeated Tempo change.
2. On the supported mobile browser, verify that a normal hold does not select text, open a context menu, zoom the page, or scroll instead of adjusting Tempo.

## Test-data cleanup

1. Restore the Exercise to the Tempo recorded before the test, using Save only if the test intentionally changed the persisted value.
2. End or exit the test Session.
3. If the Routine is shared test data, verify its saved Tempo and any fixture values match their pre-test state.
