# Routine and Session Improvements Plan

## Status

Planning is complete. Implementation is intentionally deferred to a separate chat.

This plan supersedes conflicting terminology and behavior in the original prototype plan. Use [UBIQUITOUS_LANGUAGE.md](./2026-08-08-UBIQUITOUS_LANGUAGE.md) as the canonical vocabulary.

## Objective

Improve Routine construction and guided Session playback around compact editing, explicit Breaks, lightweight Quick Rests, clearer visual hierarchy, media-style controls, configurable audio, and reliable bottom-sheet focus behavior.

## Confirmed product decisions

### Routine entries

- A Routine contains an ordered collection of **Routine entries**.
- A Routine entry is either an **Exercise** or a **Break**.
- A Break has the fixed displayed title `Break`, a required Duration, and no Tempo.
- The editor action is labeled **Add break**. “Long break” is not used in the UI or canonical domain language.
- Breaks may appear anywhere, including first, last, and directly beside another Break.
- A Break-only Routine may start a Session.
- If the last Routine entry is deleted, immediately insert a default Exercise named `Exercise`.
- The restored default Exercise uses the YAML-defined default Tempo and default Exercise Duration.
- The required numeric value of the YAML default Tempo was not selected during planning and must be chosen explicitly during implementation.

### Durations and totals

- Exercise Duration is edited in whole minutes but stored in seconds.
- New Exercises use the YAML-defined default Exercise Duration, initially five minutes.
- Exercise Duration controls change by one minute.
- Clearing Duration makes an Exercise open-ended.
- When Exercise Duration is blank, `+` initializes it to one minute and `-` initializes it to the configured default Exercise Duration.
- New Breaks default to two minutes.
- Break Duration is edited in whole minutes, changes by one minute, and has a maximum of twenty minutes.
- Quick Rest defaults to 30 seconds, changes in five-second increments, and ranges from 0 through 180 seconds. Zero disables it.
- Calculated Routine Duration includes actual timed Exercise and Break Durations plus eligible Quick Rests.
- Each open-ended Exercise contributes the YAML-defined default Exercise Duration to the estimate.
- Ceil the complete total to whole minutes. Prefix it with `~` or `approximately` in accessible text whenever any Exercise is open-ended; the visual design may use `≈`.

### Quick Rest

- **Quick Rest** replaces all previous “small break” terminology.
- Quick Rest is a timed transition, not a Step and not a Routine entry.
- A positive Quick Rest Duration creates a Quick Rest only between two directly adjacent Exercises.
- No Quick Rest occurs on a boundary touching a Break.
- Quick Rest is omitted from progress segments and the Now Playing list.
- Quick Rest displays a Countdown, uses the stretching silhouette, has a Completion cue, and never has a Warning cue.
- **Skip Quick Rest** deliberately ends it early.
- Rewind during Quick Rest restarts the preceding Exercise.

### Routine settings

- Store these values on each Routine:
  - Quick Rest Duration;
  - Warning lead time;
  - Metronome sound.
- Warning lead time defaults to 20 seconds, is edited in five-second increments, and ranges from 0 through 120 seconds.
- Zero Warning lead time disables Warning cues.
- Omit a Warning cue when a timed Step's Duration is less than or equal to its Warning lead time.
- Provide three synthesized Metronome sounds: `Classic`, `Wood`, and `Digital`.
- Existing Routines migrate to `Classic` and retain their existing Warning lead time.

### Routine editor

- Remove the `Routine` eyebrow and the `Exercises` heading.
- The top-level header shows only the Routine name, an icon-only ghost button for editing the name, and calculated total Duration.
- Give the icon-only edit action an accessible name such as `Edit routine name`.
- Put Quick Rest Duration, Warning lead time, and Metronome sound in one compact settings block.
- Show Exercise and Break entries in the same ordered list, with Breaks using a consistently darker accent.
- End the list with **Add exercise** and **Add break** actions.
- Make the entry editor more compact:
  - Exercise name occupies one full-width row;
  - Tempo occupies one row with `-`, numeric input, and `+` controls;
  - Duration occupies one row with `-`, numeric input, and `+` controls;
  - Tempo changes by one BPM.
- Fix the existing bottom-sheet focus regression. The known cause is that `BottomSheet` reruns its focus-management effect after every keystroke because it depends on an unstable `onClose` function. Effect cleanup restores the opener's focus and setup focuses the first field, causing flicker and focus loss.

### Session presentation

- Remove the Back button and `Exercise X of N` label.
- Make the Now Playing header clickable.
- Clicking it opens a compact, non-interactive bottom sheet listing Exercise steps and Break steps.
- The list omits Quick Rests, highlights the current meaningful Step, and shows compact metadata.
- During Quick Rest, mark the upcoming Exercise as `Up next`.
- Show the next meaningful Step directly below the current title. Quick Rest itself is omitted from this subtitle.
- Progress segments represent Exercise steps and Break steps only.
- Break cards, progress segments, and progress rings share the same darker accent tone.
- During a paced Exercise, place Tempo and its `-`/`+` controls inside the progress ring.
- Place a much smaller Metronome sound selector with the Tempo control.
- During an unpaced Exercise, use a neutral Exercise silhouette in the ring.
- During a Break, show its Countdown in the ring and incorporate the coffee silhouette.
- During Quick Rest, show its Countdown in the ring and incorporate the stretching silhouette.
- For Exercises, show Countdown or Elapsed time as a small muted value below the ring without a visible `remaining` or `elapsed` label. Preserve that meaning for assistive technology.

### Session controls

- Present icon-only media controls in one row in this order:
  1. rewind;
  2. pause/resume;
  3. Stop session;
  4. finish/skip.
- Make pause/resume visually dominant and give every icon control an accessible name.
- Rewind restarts the current Exercise or Break. During Quick Rest, it restarts the preceding Exercise.
- The final control performs **Finish step** during an Exercise or Break and **Skip Quick Rest** during Quick Rest.
- Stop session opens a bottom sheet containing the `Slide to stop` control.
- Opening the sheet does not interrupt the Session.
- The sheet may be dismissed through its backdrop, Escape, or the supported sheet-dismiss gesture. Only completing the slider stops the Session.

### Audio

- Store audio presets and levels in YAML.
- Raise the primary Beat peak from 0.22 to 0.35 and verify that none of the three Metronome sounds clips.
- Allow the practitioner to change Metronome sound during a running Session.
- A session-only Metronome sound override affects subsequent Beats immediately.
- Show a small Save action when the override differs from the Routine; saving updates the Routine for future Sessions.
- Keep Tempo saving separate because it updates the current Exercise, while Metronome sound saving updates the Routine.
- Timed Exercises and Breaks receive Warning cues when their Duration permits it.
- Quick Rests never receive Warning cues.
- For a paced timed Exercise, schedule the Warning cue on the Beat nearest to the configured Warning lead point.
- For an unpaced timed Exercise or Break, schedule it at the exact Warning lead point.

### Visual treatment

- Brighten the background slightly and strengthen the existing noise texture.
- Create native SVG silhouettes rather than raster assets:
  - coffee for Break;
  - stretching for Quick Rest;
  - a neutral Exercise silhouette for an unpaced Exercise.
- Keep the silhouettes subordinate to the primary control or Countdown.

## Configuration design

Create a YAML file as the source of truth for configurable product policy. Import it into TypeScript through a current, compatible Vite YAML plugin, and add declarations for both `*.yml` and `*.yaml` modules.

The YAML configuration should include:

- default, minimum, maximum, and increment values for Tempo and Durations;
- default Exercise Duration and default Tempo;
- Break defaults and limits;
- Quick Rest defaults and limits;
- Warning lead defaults and limits;
- Metronome sound identifiers and synthesis parameters;
- Beat and cue audio levels;
- relevant interaction thresholds such as Slide to stop completion.

Do not move these into YAML:

- CSS layout measurements and design-token values;
- SVG geometry;
- universal conversion factors such as 60 seconds per minute;
- algorithmic sentinel values;
- test fixtures.

Validate imported configuration at the application boundary and expose it to the rest of the code through a typed adapter. YAML defines defaults and allowed ranges; each Routine still persists its selected settings.

## Domain and persistence changes

1. Increment the persisted Routine schema version.
2. Replace the exercises-only collection with ordered discriminated Routine entries.
3. Add Exercise and Break entry variants.
4. Preserve existing Exercise IDs, order, titles, Tempo values, Durations, and Routine settings during migration.
5. Add the default Metronome sound to migrated Routines.
6. Do not insert Breaks or change existing open-ended Exercises during migration.
7. Permit any non-empty sequence of Routine entries, including Break-only and consecutive-Break Routines.
8. Restore one default Exercise only when deletion would leave the Routine empty.
9. Capture one Exercise step or Break step for every Routine entry when the Session starts.
10. Capture Quick Rest as transition metadata after an eligible Exercise step rather than as a Step.
11. Ensure stale timer and audio callbacks remain tagged and ignored after Step or Quick Rest transitions.

## Testing requirements

Add or update tests for:

- schema migration without data loss;
- arbitrary Break placement, Break-only Routines, and consecutive Breaks;
- automatic default Exercise restoration after deleting the final Routine entry;
- YAML-defined defaults and validation bounds;
- minute-based editing with seconds-based persistence;
- the special blank-Duration `+` and `-` behavior;
- Quick Rest generation only between directly adjacent Exercises;
- calculated total Duration, ceiling, and open-ended estimation;
- stable focus and no sheet animation restart while typing;
- progress and Now Playing omission of Quick Rest;
- ring contents for paced, unpaced, Break, and Quick Rest phases;
- context-dependent rewind and finish/skip controls;
- the Stop session slider sheet threshold and dismissal paths;
- session-only Tempo and Metronome sound overrides and independent saves;
- configurable Warning lead time, suppression rules, Break warnings, and Beat alignment;
- audio scheduling, pause/resume, interruption, stale-event protection, and Completion cues.

Run the full test suite, lint, production build, and browser-based visual/interaction QA. Verify the smallest supported phone layout and reduced-motion behavior. Audio loudness and clipping still require real-browser or device listening.

## Subagent work split

Use three subagents with non-overlapping primary ownership:

1. **Configuration/domain/persistence subagent**
   - YAML integration and declarations;
   - Routine entries and validation;
   - persistence migration;
   - Session-plan and Quick Rest transition model;
   - domain tests.
2. **Routine editor subagent**
   - compact editor UI;
   - settings block and totals;
   - Exercise/Break list behavior;
   - bottom-sheet focus regression;
   - editor tests.
3. **Session/audio subagent**
   - Session presentation and controls;
   - Now Playing and Stop session sheets;
   - audio presets, live overrides, and Warning scheduling;
   - player and audio tests.

The primary agent owns terminology, SVGs, integration, accessibility review, visual QA, and final verification. Because agents share one worktree, coordinate file ownership before parallel edits and let the primary agent stage commits sequentially.

## Commit plan

Create separate, reviewable commits in this order:

1. `docs: define routine entries breaks and quick rests`
2. `feat: add yaml-backed practice configuration`
3. `feat: migrate routines to ordered entries`
4. `feat: model quick rests as session transitions`
5. `fix: stabilize routine editor bottom sheet focus`
6. `feat: redesign routine editor entries and settings`
7. `feat: redesign session progress and controls`
8. `feat: add configurable metronome sounds and warnings`
9. `style: add break illustrations and visual polish`
10. Follow-up verification fixes, each scoped separately.

Each commit should leave tests and the build passing where practical. Do not mix unrelated formatting or pre-existing user changes into these commits.

## Completion criteria

The work is complete when all confirmed behaviors above are implemented, persisted data migrates safely, terminology is consistent in code/UI/docs, automated checks pass, browser QA finds no focus or layout regressions, and the resulting history is split into the planned commits.
