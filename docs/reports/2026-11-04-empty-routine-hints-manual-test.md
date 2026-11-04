# Empty Routine hints manual test

Status: Pending. Automated DOM tests do not verify visual alignment or CSS pointer pass-through.

## Prerequisites

Run `pnpm dev` and open its URL in a disposable browser profile. Use temporary Routines; avoid clearing existing user storage. Test at 320×568, 390×844, and desktop width, then repeat with increased browser text size.

## Steps and expected outcomes

1. Create a blank Routine. Confirm “Add an exercise”, “Adjust routine settings”, and “Edit this exercise” have readable labels and thin curved arrows with compact heads pointing at the corresponding controls. Labels must not overlap controls, one another, or the fixed footer. Confirm there is no horizontal scrolling.
2. Scroll and resize. Each visible target keeps its annotation aligned. Offscreen targets lose only their own annotation. Expand settings: its collapsed-target annotation disappears; collapse settings: it returns.
3. Click or touch through the annotations to the controls beneath. Tab through the editor: no hint takes focus and existing button names remain unchanged. Open each sheet and confirm it appears above hints. Cancel each sheet: matching content still qualifies.
4. Save a different Exercise title, Tempo, or Duration, one at a time. All hints disappear immediately after each save. Restore Practice, 100 BPM, and five minutes: hints return. Add an Exercise or Break: hints disappear.
5. Change only the Routine name, Quick Rest Duration, Warning lead time, or Metronome sound. Hints remain eligible. Switch between matching and differing Routines, reopen, and reload: visibility always follows entry content.
6. Export matching content and import it through preview/confirmation. Confirm its fresh identity does not prevent hints. Start a Session and confirm normal playback. Check that random creation and deleting the final entry retain existing behavior.

## Cleanup

Delete only temporary Routines through the Routines drawer, or close the disposable browser profile. Do not clear a profile containing real saved Routines.

## Results

Not executed in this session: no browser automation tool was available. All viewport, visual, touch, keyboard, text-size, and stacking gates above remain pending.

## Dense-layout deviation

When there is insufficient safe space below the card or between settings and the card, annotations temporarily hide even if their controls are visible. This avoids covering Exercise content or controls, but deviates from the plan’s requirement to annotate every visible target. Validate the viewport matrix before treating visual acceptance as complete. Final review found no remaining concrete code blocker with this limitation recorded.
