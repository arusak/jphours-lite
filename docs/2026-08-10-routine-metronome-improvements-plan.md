# Plan: Routine Ordering, Metronome, and UI Transitions

Date: 2026-08-10

Status: Agreed implementation plan. No application code was changed during the design session.

Related decision: [Beat Synchronization](2026-08-10-beat-synchronization-architecture.md).

## Goals

- Restore reliable Routine entry reordering with an established DnD library.
- Add an Alternate Beat tone three semitones below the main Metronome sound.
- Synchronize audible Beats, beat dots, `TimerRing`, and Warning cue against one Web Audio grid.
- Eliminate artificial Beats during live Tempo changes.
- Collapse top-level Routine settings by default.
- Give every Bottom Sheet a correct React exit lifecycle.

## Out of Scope

- User-facing time-signature, complex Beat-pattern, or multi-accent controls.
- RxJS or another streaming dependency.
- Custom keyboard-reordering logic.
- Redesigning Routine entry cards beyond setting `gap: 0` and removing corner rounding.
- Automatic Tempo persistence: Tempo remains a Session override until Save is pressed.

## Agreed Decisions

### Routine Ordering

- Use the modern Sortable API from `@dnd-kit/react`; verify the package and API against current official documentation during implementation.
- Dragging begins only from a visible drag handle.
- Pointer, touch, and keyboard reordering use the sensors supplied by dnd-kit. Do not create a separate keyboard implementation.
- A drag overlay shows the lifted Routine entry while sortable layout moves its neighbors.
- Both Exercises and Breaks can be reordered. The resulting order becomes the Routine order and the order of future Session plans.
- The existing debounced Routine autosave persists the new order after drop.
- Use `gap: 0` between entries. Preserve the current card style but remove card rounding.

### Metronome Sound and Beat Pattern

- Add a boolean `Alternate beat tone` setting to Routine, defaulting to `true`.
- Give old Routine data without the field a tolerant default of `true` through migration or normalization.
- The initial pattern contains four positions; Beats 2 and 4 use the alternate tone.
- The alternate tone retains the selected sound's waveform and decay and uses `baseFrequency × 2^(-3/12)`.
- The internal model distinguishes `beatIndex`, `positionInPattern`, and `accent`, leaving room for 3/4 and multiple accent levels.
- Switch label: `Alternate beat tone`. Helper text: `Even beats use a lower tone.`
- Metronome sound and Alternate Beat tone changes save automatically to Routine from both Routine Editor and Session.
- Changing the switch during a Session does not restart the Metronome and applies to the next Beat that has not yet been scheduled.

### Beat Synchronization and Visuals

- The Web Audio clock is the canonical Beat-grid source.
- A small `BeatClock` or `BeatTimeline` exposes a snapshot and `subscribe/getSnapshot`; React consumes it through a thin subscription hook.
- The contract distinguishes a scheduled Beat from an audible Beat boundary. Look-ahead scheduling must not update the UI early.
- The clock carries a generation token used to discard **Stale events** after Pause, Resume, Stop, or a Current phase change.
- Increase the beat dots from 10 px to 14 px. They change only a static style at an audible boundary, with no pulse, flicker, keyframes, or transitions.
- Advance `TimerRing` discretely at audible boundaries with a fixed 150 ms `ease-out` transition.
- Immediately set the ring to 100% at Completion, even when Completion falls between Beats.
- Align the Warning cue to the actual Beat grid supplied by the same clock.

### Live Tempo

- Pressing `+/-` changes a Session override without creating a Beat or restarting the scheduler.
- Keep the closest already scheduled Beat at its original time; apply the latest Tempo to the interval after it.
- Rapid repeated presses leave one ordinary rhythmic stream and one current Tempo value.
- Do not reset the Beat index, pattern position, or accent sequence.
- Pause and Stop cancel or invalidate pending audio and UI callbacks. Resume starts a new grid with the current Session Tempo.
- Save Tempo to Routine only through the existing Save button.

### Collapsible Routine Settings

- Start `RoutineSettings` collapsed whenever Routine Editor opens. Expanded state is local UI state and is not persisted.
- The collapsed summary shows `Session settings` and the current Quick Rest, Warning cue, and Metronome sound values.
- Make the complete header row a disclosure button with `aria-expanded` and `aria-controls`.
- Remove the hidden panel from keyboard and accessibility navigation with `inert` and consistent ARIA semantics.
- Animate both expansion and collapse for approximately 180 ms while preserving the current card style.
- Complete the transition immediately under `prefers-reduced-motion`.

### Bottom Sheet Exit Lifecycle

- Fix React presence state first; exit keyframes alone are not a solution.
- Give the shared `BottomSheet` a `closed/opening/open/closing` lifecycle or an equivalent controlled-presence model.
- Closing must not immediately destroy the dialog DOM. Keep a closing snapshot mounted until exit completes, then unmount and restore focus.
- Apply the common lifecycle to Editor Sheet, Metronome Sound Sheet, Now Playing Sheet, and Stop confirmation.
- Save and confirmed Stop execute immediately. The presence layer keeps the closing sheet visible over the already updated underlying screen.
- Move the sheet down over 180 ms with `ease-in` while fading the backdrop. Keep the current 180 ms `ease-out` entry.
- Block repeated Escape, backdrop clicks, and action events while closing.
- Under reduced motion, complete close and focus restoration immediately.
- Provide a fallback when `animationend` does not arrive or a consumer unmounts unexpectedly.

## Implementation Steps

### 1. Prepare the DnD Dependency and Reorder Seam

Files: `package.json`, `pnpm-lock.yaml`, `src/domain/` or a focused routine-editor helper, and `useRoutineEditor.ts`.

1. Add and lock the selected dnd-kit packages.
2. Introduce a pure move operation based on stable Routine entry IDs rather than transient DOM indices.
3. Update `routine.entries` with one immutable transition; keep autosave as the downstream effect.
4. Verify that Session plan construction preserves the new order and creates Quick Rest only between adjacent Exercises.

### 2. Add a Sortable Routine Entry List

Files: `RoutineEntryList/`, `RoutineEntryCard/`, and, if needed, `src/components/Icons/Icons.tsx`.

1. Add the dnd-kit context and a sortable collection keyed by stable IDs.
2. Attach library attributes and listeners only to the drag handle, not edit or delete controls.
3. Use the library's Pointer, Touch, and Keyboard sensors, accessibility announcements, and DragOverlay.
4. Add overlay and original-card visual states without custom pointer or keyboard handlers.
5. Set `gap: 0`, remove rounding, and preserve all other current styles.

### 3. Extend Routine Sound Settings

Files: `src/domain/routine.ts`, validation, `routine-repository.ts`, `MetronomeSoundSheet/`, Routine Editor, and Session save callbacks.

1. Add the boolean field with a default of `true`, migration, and validation.
2. Add the switch row and helper text to the reusable sound sheet.
3. Auto-commit sound and switch changes to Routine from both entry points.
4. Keep Tempo on its separate Save flow.

### 4. Introduce the Beat Pattern and BeatClock

Files: `src/services/audio/`, `useSessionPlayer.ts`, and a focused subscription hook or store if needed.

1. Define a Beat descriptor and snapshot containing index, pattern position, accent, audio time, Tempo, running state, and generation.
2. Retain the Web Audio look-ahead scheduler as the precise audio mechanism.
3. Select oscillator frequency from the Beat descriptor; alternate Beats use a three-semitone downward offset.
4. Deliver audible snapshots at calculated audio times rather than at scheduling time.
5. Centralize cancellation and Stale event protection.

### 5. Fix Live Tempo Rescheduling

Files: `AudioController.updateMetronomeTempo`, scheduler state, `useSessionPlayer.changeTempo`, and the existing test that describes restart behavior as a clean Beat boundary.

1. Remove stop/cancel/restart and the artificial `currentTime + 0.05` Beat from ordinary Tempo updates.
2. Preserve the nearest pending Beat and apply the latest Tempo to the following interval.
3. Preserve pattern position.
4. Retain the distinction between a Session override and explicit saving to Routine.

### 6. Connect Visual and Warning-Cue Consumers

Files: `SessionPlayer.tsx` and its styles, `TimerRing/`, and `SessionRunner` warning scheduling.

1. Move the dots from the scheduling callback to the audible snapshot, enlarge them to 14 px, and remove animations and transitions.
2. Derive discrete ring progress from Beat boundaries and apply only the 150 ms `ease-out` step transition.
3. Send 100% progress immediately at Completion.
4. Schedule the Warning cue from the BeatClock grid and invalidate stale warnings after a Tempo change.

### 7. Make Routine Settings a Disclosure

Files: `RoutineSettings.tsx`, its styles, and focused Routine Editor tests.

1. Add local default-collapsed state and an accessible header button.
2. Build a compact summary from the three current setting values.
3. Implement expansion and collapse without JavaScript height measurement if the CSS grid technique satisfies the project's browser support.
4. Remove hidden controls from keyboard and accessibility navigation and support reduced motion.

### 8. Fix Bottom Sheet Presence

Files: `src/components/BottomSheet/`, every consumer, and their tests.

1. Replace conditional immediate unmounting with a controlled presence lifecycle.
2. Retain the final dialog payload while closing, even after a consumer has executed Save or Stop or cleared its open state.
3. Add closing states to the sheet and backdrop. Keep the focus trap and body lock active until presence ends.
4. Block repeated actions and guarantee one completion through an event or timeout fallback.
5. Complete presence synchronously under reduced motion.

## Focused Test Coverage

### Routine Ordering

- Pointer and touch reordering persist the new Exercise and Break order.
- Keyboard reordering runs through the dnd-kit Keyboard sensor.
- Edit and delete clicks do not start dragging.
- Session plan and Quick Rest derivation use the new order.
- Autosave receives the Routine after drop.
- The list has no gap or card rounding.

### Metronome and BeatClock

- Old Routine data normalizes Alternate Beat tone to `true`.
- The switch auto-saves from Routine Editor and Session.
- Beats 2 and 4 retain waveform and decay and use a frequency three semitones lower.
- Disabling the switch keeps the base frequency on every Beat.
- UI snapshots arrive at audible boundaries, not scheduling callbacks.
- Rapid Tempo changes do not create extra oscillators or Beats.
- The pending Beat remains in place and the final Tempo applies after it.
- Beat index and accent sequence do not reset.
- Pause, Resume, Stop, and Current phase changes block stale callbacks.
- Warning cue uses the same grid.
- Completion fills the ring to 100%.

### Visuals, Disclosure, and Bottom Sheet

- Beat dots are 14 px and have no animation or transition.
- The ring advances from Beat snapshots using `ease-out 150ms`.
- Settings start collapsed, the header reflects `aria-expanded`, and the hidden panel is inert.
- The summary updates after setting changes, and reduced-motion behavior is correct.
- Escape and backdrop requests move Bottom Sheet to closing rather than removing its DOM immediately.
- Save and Stop run immediately and exactly once while closing presence remains.
- The sheet and backdrop leave after 180 ms, followed by focus restoration.
- Repeated close and action events are ignored; fallback and reduced motion complete the lifecycle.
- Every Bottom Sheet consumer uses the shared mechanism.

## Verification After Implementation

1. Run focused Vitest suites for domain, persistence, audio, Session Runner, Routine Editor, Session Player, and BottomSheet.
2. Run the complete `pnpm test` and `pnpm build` commands.
3. Manually verify DnD with a mouse, touch emulation, and the dnd-kit Keyboard sensor.
4. Rapidly press `+/-` at several Tempo values and confirm that presses do not create Beats.
5. Compare audio, dots, ring, and Warning cue at slow and fast Tempo values.
6. Exercise Bottom Sheet close through backdrop, Escape, Save, and Stop, including reduced motion.

## Documentation

- Update `docs/files.json` whenever implementation adds or removes files.
- If implementation refines Beat-pattern terminology, update `docs/UBIQUITOUS_LANGUAGE.md` in a focused change.
- Record deviations from this plan in an implementation report after completion.
