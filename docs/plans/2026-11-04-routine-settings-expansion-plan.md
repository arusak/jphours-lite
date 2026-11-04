# Routine settings: growing border and fading content

Date: 2026-11-04
Status: Ready for implementation

## Scope and approved behavior

Replace the Routine editor's separate summary and expanded settings card with one rounded surface. Its border grows and shrinks while its content fades between the compact summary and controls. The expanded state contains no summary block. The user approved a small collapse chevron and approximately 220ms transitions, with immediate switching for reduced motion.

Non-goals: changing setting values, increments, bounds, persistence, Session behavior, sound selection behavior, other cards, dependencies, or global animation infrastructure.

## Acceptance contract

1. Initially show the existing summary and expand affordance in one compact rounded border. Preserve current summary wording, including Warning cue Off and the selected Metronome sound.
2. Opening grows the same outer border to contain Quick Rest, Warning cue, and Metronome sound controls. Fade the summary out and controls in. There must be no persistent summary row or second bordered card in the expanded state.
3. A small upward chevron inside the expanded surface closes it. Give it the accessible name `Collapse settings`. Closing reverses the effect and restores an up-to-date summary. Do not make the entire controls surface a toggle or nest buttons.
4. Animate container height and content opacity over approximately 220ms with ease-out timing. Keep border thickness and rounded corners stable; do not scale the contents or border. Surrounding Routine entries move with the changing layout rather than jumping at the end.
5. Rapidly reversing direction converges to the last requested state without stuck content, double borders, timers firing late, or stale values. Resizing and wrapped summary text must not clip final content or depend on a fixed expanded height.
6. Only the active face is exposed to assistive technology and keyboard navigation, including during the transition. Opening transfers focus from the disappearing summary trigger to the collapse button; closing restores focus to the summary trigger. Native buttons retain Enter/Space support and visible focus indicators. Keep the settings section meaningfully labelled when the summary is hidden.
7. Reduced motion switches immediately, including height and opacity. Hidden controls remain inert and inaccessible. Sound-sheet focus return still reaches the Metronome sound button; Escape dismisses that sheet without unexpectedly closing settings.
8. Preserve existing Stepper callbacks, disabled bounds, warning Off semantics, sound auto-commit and Alternate beat tone behavior. Changes survive collapse/reopen and remain reflected in the summary. Preserve current component-local expansion lifetime across Routine changes; switching Routine updates displayed values without persisting expansion. Unmounting/remounting starts collapsed.

## Diagnosis and evidence

Current owner: `src/features/routine-editor/RoutineSettings/RoutineSettings.tsx`, symbol `RoutineSettings`, owns local `expanded` and `soundPickerOpen` state. `RoutineEditor` supplies the selected Routine and mutation callbacks. `Stepper` renders existing controls; `MetronomeSoundSheet` owns the shared sound selection interaction.

Direct source evidence: the `settingsHeader` is always rendered before a separate `settingsDisclosure` containing `settingsCard`. The CSS gives the header and card their own borders and radii, with a flex gap between them. Opening only exposes the card; it cannot replace the summary. This matches the supplied screenshot. The disclosure transitions grid rows over 180ms but does not transition opacity, so content visibility changes abruptly. Confidence in this structural cause is high.

This is a requested visual behavior change, not a runtime failure. Investigation was read-only; no red reproduction test, browser reproduction, or baseline suite was run. No alternative runtime-cause hypothesis is needed to explain the two surfaces. The proposed visual quality remains unverified until implementation is viewed in a browser.

Existing `tests/RoutineEditor.test.tsx` coverage checks initial summary, aria-expanded, aria-hidden, inert, opening, and sound updates. It expects the original disclosure button to remain expanded after opening; that expectation must change because the summary face will disappear. It does not assert replacement, reverse transitions, focus transfer, or rendered animation. JSDOM and the animation stubs in `src/test/setup.ts` cannot verify visual interpolation.

## Design and ownership

Keep state and markup in `RoutineSettings`, styling in its existing CSS module, and existing public props unchanged. No new hook, shared component, persistence field, or animation dependency is necessary.

Use one persistent bordered wrapper with a state attribute and two internal faces. Keep both faces mounted so CSS can fade them, but mark the inactive face aria-hidden and inert immediately when the requested state changes. Give the section a stable accessible name independent of the hidden summary. Preserve `routine-settings-panel` as the controls target where useful; do not leave its labelling dependent on inaccessible content.

Implement intrinsic height interpolation with CSS grid rather than numeric height measurement: overlap the faces in one grid area, with the inactive face constrained to zero height and overflow clipped, and transition the wrapper's single row between the compact face's intrinsic height and the controls face's intrinsic height using animatable grid sizing. Verify this technique in the target browser before settling it. If overlapping faces prevent reliable intrinsic interpolation, use separate complementary 0fr/1fr grid disclosure tracks inside the same border; fade their contents and maintain zero gap so the inactive face reserves no final space. The invariant is one border with no expanded summary footprint, not a particular grid recipe. Avoid max-height guesses, scale transforms, timeouts, and transition-end-dependent state.

Add a compact, independently clickable collapse button inside the controls face without inserting another full summary/header block. Reuse `ChevronRightIcon` with CSS rotation and currentColor. Keep it clear of the first Stepper's controls at narrow widths. Focus the destination button after React commits the new active face, using local refs and a direct toggle handler or focused effect. Do not steal focus on initial render, ordinary setting changes, Routine switches, or sound-sheet dismissal.

CSS transitions should follow the requested boolean state directly so reversal is naturally interruptible. Opacity fades must be explicit; transitions on height alone do not satisfy the request. Apply reduced-motion overrides to every new animated property. Retain clipping only where needed for transitions, ensuring final controls and focus indicators remain usable.

No domain or architectural boundary changes are proposed. This document records the approved local presentation decision; no ADR is necessary for this change. The existing `docs/plans/` and `RoutineSettings/` inventory entries already cover the planned files.

## Ordered execution

1. In `src/features/routine-editor/tests/RoutineEditor.test.tsx`, extend the disclosure regression first. Assert the initial summary, then open and assert the summary is inaccessible, `Collapse settings` is available and focused, and controls are exposed. Collapse and assert focus restoration, inaccessible/inert controls, and summary restoration. Run the focused command below and confirm the new behavior assertions fail against the old implementation.
2. In `RoutineSettings/RoutineSettings.tsx`, retain local state and callbacks, introduce the persistent surface and active faces, add stable labelling and the collapse button, and implement focus transfer. Preserve `MetronomeSoundSheet` placement outside clipped animated content. Update old tests that retain the disappearing disclosure as their accessible trigger.
3. In `RoutineSettings/RoutineSettings.module.css`, consolidate borders/radii onto the surface, remove the gap and separate card border, implement intrinsic expansion/contraction and content opacity transitions, and style the small chevron. Cover reduced motion and narrow layouts. Delete obsolete header selectors and expanded-chevron rules instead of keeping unused styles.
4. Extend focused integration coverage for settings changes followed by collapse/reopen, sound-sheet open/select/dismiss, boundary-disabled Steppers, repeated toggles, and selected Routine changes while expanded. Assert final accessible state and values rather than CSS timing. Keep tests in the existing editor test file unless isolation is materially clearer.
5. Perform browser verification, then run automated gates. No generated code, schema, dependency, configuration, inventory, or unrelated source changes are expected. If additional files become necessary, update inventory according to repository conventions.

## Verification

Run the focused command first for the failing regression and again after implementation:

```sh
pnpm exec vitest run src/features/routine-editor/tests/RoutineEditor.test.tsx
```

After focused checks pass:

```sh
pnpm test
pnpm run build
pnpm run lint
pnpm run format:check
```

Do not treat JSDOM assertions or a green baseline as proof of smooth animation. Record exact failures and distinguish pre-existing failures from changes introduced here; avoid unrelated formatting churn.

Browser gate: run `pnpm dev` and open `/jphours-lite/` with an existing test Routine. At narrow mobile and desktop widths, open and close settings and inspect the intermediate frames: a single border grows/shrinks, summary and controls fade, no second box remains, and entries below move smoothly. Reverse direction repeatedly during transitions and resize with long/wrapped summary content. Check no control collision, clipping, or lingering empty space. With keyboard only, verify focus transfer in both directions and that hidden controls cannot be reached. Change both numeric settings, select a sound and dismiss its sheet with Escape, then collapse/reopen and check values. Emulate reduced motion and verify immediate switching. Switch Routine while expanded and confirm displayed values update without changing expansion. Use isolated test data; no full-stack or operational service gate is needed for this local presentation change.

## Risks and binary completion criteria

Main risks are intrinsic-height interpolation in the supported browser, focus moving into an inert face, clipped focus outlines, and collision between the collapse button and first Stepper. Resolve with the browser and keyboard gates; CSS declarations alone cannot prove these requirements.

Implementation is complete only when one border replaces the two surfaces, summary is absent from the expanded layout, content fades while the border grows/shrinks in both directions, reduced motion and focus behavior pass, existing settings behavior remains intact, and focused/full checks and browser results are recorded honestly. A failed core visual or keyboard gate prevents completion.

Planning validation status: source and existing tests inspected; production code untouched. Red-first regression, full suite, build, lint, formatting, and browser gates are pending implementation. Only this approved plan file is authorized by this planning workflow.
