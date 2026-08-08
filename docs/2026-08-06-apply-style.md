# JP Hours design integration plan

## Goal

Apply the visual language and phone-first layout from `design/` to the working Vite app without replacing its persistence, audio, timer, wake-lock, or session lifecycle behavior. Prototype-only controls must either become functional or be removed.

## Product decisions

- Keep a centered phone-width canvas (about 460px) on larger screens.
- Replace inline exercise editing with summary cards and an Add/Edit bottom sheet.
- Reorder exercises by touch/mouse drag, with keyboard-accessible alternatives.
- Keep every duration input as one value in seconds; format seconds as `m:ss` only for display.
- Add paced open-ended exercises: a tempo may exist without a duration.
- Show one progress segment for every executable step, including breaks.
- During a session, BPM changes are session-only by default. Show a small **Save** action beside the BPM only while it differs from the saved exercise.
- Saving a changed BPM updates the stored routine for future sessions without changing the rest of the active session snapshot.
- An open-ended exercise shows elapsed time and a static timer ring.
- From a break, Rewind restarts the preceding exercise; normal advancement then replays the break.
- Back exits the active session immediately. Stop uses a slide-to-confirm interaction.
- Remove the prototype's three-dot menu until it has a real action.

## Visual implementation contract

This section is the authoritative visual specification. An executor should be able to implement the UI from this document without opening `design/`.

### Theme tokens

Use these values directly as CSS custom properties. The app is dark-only for this scope.

```css
:root {
  color-scheme: dark;

  --color-background: oklch(0.17 0.015 55);
  --color-foreground: oklch(0.95 0.012 80);
  --color-card: oklch(0.215 0.018 52);
  --color-card-foreground: oklch(0.95 0.012 80);
  --color-popover: oklch(0.215 0.018 52);
  --color-popover-foreground: oklch(0.95 0.012 80);
  --color-primary: oklch(0.81 0.145 74);
  --color-primary-foreground: oklch(0.2 0.03 55);
  --color-secondary: oklch(0.27 0.02 52);
  --color-secondary-foreground: oklch(0.93 0.012 80);
  --color-muted: oklch(0.26 0.018 52);
  --color-muted-foreground: oklch(0.7 0.025 72);
  --color-accent: oklch(0.63 0.16 42);
  --color-accent-foreground: oklch(0.98 0.01 80);
  --color-destructive: oklch(0.58 0.19 27);
  --color-destructive-foreground: oklch(0.98 0.01 80);
  --color-border: oklch(0.98 0.01 80 / 10%);
  --color-input: oklch(0.98 0.01 80 / 14%);
  --color-ring: oklch(0.81 0.145 74);

  --font-body: "Geist", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;

  --radius-base: 0.9rem;
  --radius-sm: calc(var(--radius-base) - 4px);
  --radius-md: calc(var(--radius-base) - 2px);
  --radius-lg: var(--radius-base);
  --radius-xl: calc(var(--radius-base) + 4px);
  --radius-2xl: calc(var(--radius-base) + 10px);
  --radius-3xl: calc(var(--radius-base) + 18px);

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 28px;
  --space-8: 32px;
  --space-10: 40px;
}
```

Opacity variants are the named color with an alpha channel; for example, `primary/15` means `oklch(0.81 0.145 74 / 15%)`. Do not substitute blue-gray neutral colors from the current app.

### Typography

- Body: Geist, 16px base, normal line height, with font features `"ss01", "cv01"`.
- Display text, numeric timers, button labels, and prominent headings: Space Grotesk.
- Routine title: 30px, 700, tight tracking.
- Exercise/break title: 48px, 700, tight tracking, balanced wrapping; reduce to 40px below 360px wide.
- Current BPM: 60px, 700, line-height 1, tight tracking, primary color.
- Timer value: 72px, 600, line-height 1, tight tracking; reduce to 60px below 360px wide.
- Section label: 14px, 600, uppercase, `0.16em` letter spacing.
- Eyebrow: 12px, 500–600, uppercase, `0.20em` to `0.24em` letter spacing.
- Card title: 18px, 600. Body/control copy: 14px. Badges and helper labels: 12px.
- All times, counts, durations, and BPM values use tabular numerals.

### App frame and background

- The outer app is `position: relative`, full width, `min-height: 100dvh`, background token, and clips horizontal overflow.
- Center a `width: 100%`, `max-width: 460px`, `min-height: 100dvh` flex-column canvas. On desktop, the ambient background continues edge-to-edge; do not add a phone border or shadow.
- Add a 520px circular glow centered horizontally at `top: -128px`: `radial-gradient(circle, oklch(0.63 0.16 45 / 22%), transparent 68%)`, blurred about 64px.
- Add a 420px circular glow at `right: -10%`, `bottom: -10%`: `radial-gradient(circle, oklch(0.81 0.145 74 / 14%), transparent 70%)`, blurred about 64px.
- Add a non-interactive tiled monochrome fractal-noise overlay (`140px × 140px`, base frequency `0.85`, two octaves) at 5% opacity using `mix-blend-mode: soft-light`.
- Screen padding is normally 24px horizontally. At widths below 360px, use 16px. Include `env(safe-area-inset-*)` in top and bottom padding.
- Keep the document vertically scrollable on short screens. Never allow the sticky controls or a 268px timer to clip.

### Shared component geometry and states

- Use Lucide icons with 2px strokes. Standard inline icons are 16px; card drag icons and top-bar icons are 20px.
- Top-bar icon button: 40px circle, `card/70` background, 1px border, muted icon; foreground icon on hover/focus.
- Small card icon button: 32px square, `radius-md`, transparent; use `foreground/5` on hover. Delete uses `destructive/12` hover fill and destructive foreground.
- BPM stepper button: 48px square, `radius-2xl`, `card/70` fill, 1px border, 20px icon.
- Primary button: full width, at least 56px high, `radius-2xl`, primary fill/foreground, 16px 600 display text, 20px icon, and `0 10px 24px primary/25` shadow.
- Secondary button: at least 48px high, `radius-2xl`, secondary fill, secondary foreground, and 1px border.
- Destructive surfaces use `destructive/12` fill, destructive text, and a `destructive/30` border; do not use a solid red button.
- Pressed buttons scale to `0.99`; 48px square controls may scale to `0.95`. Use 150–200ms color/transform transitions.
- Focus-visible state: 3px `color-ring/50` halo plus a ring-colored border. Disabled controls are 50% opaque and non-interactive.
- Respect `prefers-reduced-motion`: remove scaling, beat pulsing, sheet sliding, and drag animation while retaining state/color changes.

### Timer ring

- Render as a responsive 268px square SVG with `viewBox="0 0 268 268"`; maximum width is the available viewport minus 48px.
- Circle radius is 128px and stroke width is 12px. Rotate the progress circle `-90deg`, use round line caps, and clamp progress to 0–1.
- Track stroke: `oklch(0.98 0.01 80 / 8%)`.
- Exercise gradient: `oklch(0.86 0.15 82)` to `oklch(0.66 0.17 45)`.
- Break gradient: `oklch(0.72 0.16 55)` to `oklch(0.58 0.19 32)`.
- Place a radial glow inside the ring with a 24px inset, about 40% opacity, and 32px blur.
- Center the 72px time over a 12px uppercase label with `0.22em` tracking and 12px separation.
- Timed steps draw the fraction elapsed. Open-ended steps show elapsed time with the complete track but no progress arc or looping animation.

### Progress segments and beat indicator

- Render one segment per session step in a horizontal flex row: 6px high, fully rounded, 6px gap, equal width.
- Exercise screen: completed `primary/45`, current primary, future `foreground/10`.
- Break screen: completed `accent/45`, current accent, future `foreground/10`.
- For more than 12 steps, keep every segment but reduce the gap to 3px; do not scroll or collapse steps.
- The metronome indicator is four 10px circular dots with 12px gaps. Inactive dots use `foreground/15`; the current beat uses primary.
- Beat pulse keyframes: at 0%/100%, scale `0.72` and opacity `0.35`; at 50%, scale `1` and opacity `1`. The UI beat must be driven by the audio scheduler callback, not an unrelated one-second CSS loop.

### Bottom sheet and fields

- Use a modal bottom sheet for routine-name and exercise Add/Edit flows. Backdrop is black at 55% opacity.
- Sheet is fixed to the bottom, centered, `width: min(100%, 460px)`, maximum height `85dvh`, scrollable internally, card background, 1px top/side border, and 32px top corners.
- Use 24px side padding, 16px top padding, and bottom padding of `max(24px, env(safe-area-inset-bottom))`.
- Add a centered 40px × 4px muted drag indicator, then a 20px/600 display title 16px below it.
- Field groups have 16px separation. Labels are 12px/600 uppercase with `0.12em` tracking. Inputs are at least 48px high, full width, `radius-xl`, input background, 1px border, 16px text, and 12px horizontal padding.
- Invalid inputs use a destructive border and 3px `destructive/20` focus halo; error copy is 12px destructive text, 6px below the field.
- Sheet actions are a full-width primary Save button and a secondary Cancel action. Trap focus, close on Escape/backdrop only when no pointer drag is active, restore focus to the opener, and prevent background scrolling.

### Dragging and deletion feedback

- The 32px drag handle is the only pointer drag activator so edit/delete remain reliable.
- While lifted, a card uses opaque card fill, a primary/30 outline, `0 16px 36px black/35` shadow, and `scale(1.02)`; the original slot remains visible at 35% opacity.
- Auto-scroll the exercise list near viewport edges. Announce lift, new position, drop, and cancel through a polite live region.
- After deletion, show a bottom toast above the sticky footer for five seconds with the exercise name and an Undo action. Persist the deletion immediately; Undo restores the same item and index.

### Slide-to-stop control

- Use a full-width 56px-high track with `radius-2xl`, `destructive/12` fill, `destructive/30` border, and centered 14px/600 destructive text: “Slide to stop”.
- Thumb is 48px square/circle, inset 4px, destructive fill with destructive-foreground square icon, and a subtle shadow.
- Stop only when the thumb reaches at least 90% of its available travel. Releasing earlier animates it back in 180ms. While dragging, the label fades toward 25% opacity.
- Expose it as an accessible slider with value 0–100 and the same 90% threshold. Arrow keys move by 10; Home resets; End reaches confirmation. Stop fires once per gesture.

## Screen layouts

### Routine editor

- Content column: 24px side padding, 32px top padding, and 160px bottom padding to clear the sticky footer.
- Header: routine eyebrow, then title 4px below. Place an Edit button at the top right with 12px horizontal/8px vertical padding, `radius-xl`, `card/70` fill, 1px border, 12px/600 text, and a 14px pencil icon.
- Break row: 24px below the header, top/bottom 1px borders, `card/40` fill, 14px horizontal and 10px vertical padding. Left side is a 16px accent timer icon plus “Small breaks”. Right side is two 32px stepper buttons around a centered 56px-wide seconds value.
- Exercise heading row: 32px below the break row. Put the uppercase section label left and a rounded count badge right (`foreground/5`, 1px border, 10px horizontal/2px vertical padding).
- Exercise list begins 12px below the heading with 12px vertical gaps.
- Exercise card: top/bottom 1px borders, `card/40` fill, 16px padding. Layout is a 20px drag handle, flexible content, then 32px Edit and Delete buttons, with 12px gaps.
- Card index is 24px square, `radius-md`, `primary/15` fill, 12px/700 primary text. Put the 18px title beside it with 8px gap.
- Metadata badges sit 12px below, wrap, and have 8px gaps. Badges use 10px horizontal/4px vertical padding and 14px icons. Tempo uses primary text/fill/border; normal duration uses neutral fill/border; open-ended uses accent text/fill/border. Display a numeric duration formatted as compact `m:ss` or `Xs`, despite editing it as seconds.
- Add exercise: 16px below cards, full width, 16px vertical padding, dashed border, `radius-2xl`; muted by default and primary on hover/focus.
- Sticky footer: bottom 0, negative top overlap of 96px, 24px sides, 40px top, and bottom `max(32px, env(safe-area-inset-bottom))`. Background fades from transparent to solid background. Start button is the primary full-width style.

### Active exercise

- Screen is a min-height flex column with 24px side/top padding and bottom `max(32px, env(safe-area-inset-bottom))`.
- Header: 40px Back button left; centered “NOW PLAYING” eyebrow over the 14px/600 routine name; a 40px inert spacer right so the title remains geometrically centered. Do not render an overflow button.
- Progress segments are 24px below the header.
- Heading block is centered 32px below progress: primary 14px/600 uppercase “Exercise X of Y”, then the exercise name 8px below.
- BPM row is 24px below the heading, centered with 16px gaps. Put 48px minus/plus controls around the BPM stack. BPM label is 6px below the number. Clamp changes to 20–300 BPM.
- When BPM differs from the saved source exercise, show a compact 28px-high Save button immediately beside the BPM label, without shifting the numeric BPM off center. Hide it after saving or reverting to the saved value.
- Timer begins 28px below BPM. Beat dots are 28px below the ring and appear only for paced modes.
- Next-up strip is 28px below: top/bottom borders, `card/40` fill, 16px horizontal/12px vertical padding, centered 14px content with 8px gaps. Use an accent coffee icon for an upcoming break and a primary music icon for an exercise.
- Controls use `margin-top: auto` with 28px top padding. Order: full-width primary Pause/Resume, full-width secondary Finish/Skip 12px below, full-width slide-to-stop 12px below.

### Break

- Use the same outer padding, header, progress, next-up strip, and bottom safety as the active exercise.
- Heading is 36px below progress. Center a 44px `radius-2xl` accent/15 icon tile and 48px “Break” title with a 12px gap. Subtitle “Shake it out. Reset your hands.” is 16px below in 14px muted text.
- Break timer is 40px below the heading and uses the break gradient.
- Next-up strip is 32px below the timer and identifies the next exercise plus BPM when present.
- Controls use `margin-top: auto` with 32px top padding. Order: full-width neutral Rewind, full-width primary Skip break 12px below, full-width secondary Pause/Resume 12px below, and full-width slide-to-stop 12px below.

### Completion, stopped, and interrupted states

- Completion and stopped screens retain the same frame/glows and vertically center a 48px display heading, 14px muted explanation, and full-width primary Return to routine button within 24px side padding.
- Completion uses primary accents and the session-complete cue. Stopped uses muted/destructive accents and must not play completion audio.
- An interrupted session keeps the active screen visible, switches the main action to Resume, freezes ring/time progress, stops beat animation, and shows a compact accent/15 status banner above controls.

## Implementation sequence

### 1. Establish the visual foundation

- Implement the color, spacing, radius, typography, glow, noise, geometry, and motion contract above in the Vite app's CSS; do not copy Next.js/Tailwind scaffolding.
- Bundle the display/body fonts locally so the installed PWA retains the intended appearance offline.
- Add the icon library used by the prototype and introduce small reusable primitives for icon buttons, primary/secondary actions, badges, the timer ring, progress segments, bottom sheets, and the app frame.
- Make the frame safe-area aware and verify the layout at 320px width, common phone sizes, and desktop.
- Preserve visible focus, reduced-motion behavior, minimum touch targets, and sufficient contrast.

### 2. Extend the domain model first

- Add `paced-open-ended` to the exercise modes and consolidate the duplicated mode derivation so editor validation and session construction cannot disagree.
- Permit `tempoBpm` with a null duration in validation and session-step construction.
- Add a reducer/runner command that rewinds from a break to its preceding exercise while preserving timer and audio hook correctness.
- Add an audio operation for changing the active metronome tempo cleanly during a running exercise.
- Cover all four exercise modes, rewind, pause/resume after rewind, stale timer cancellation, and live tempo changes with unit tests.

### 3. Rebuild the routine editor around the prototype

- Render the routine title, break control, exercise count, compact exercise cards, Add exercise action, and sticky Start session footer using real routine data.
- Open routine-name editing and Add/Edit exercise flows in focused sheets; keep validation messages next to their fields.
- Keep tempo and duration independently optional, label the resulting mode clearly, and use seconds for duration and break inputs.
- Implement delete with an undo opportunity, rather than an easy irreversible tap.
- Implement touch/mouse drag reordering with a dedicated handle plus keyboard move controls and announcements for assistive technology.
- Keep debounced persistence and flush-on-visibility behavior intact.

### 4. Rebuild the session and break views from live state

- Replace the static mock data with the runner's current step, step index, next step, remaining/elapsed time, pause state, and dynamic progress segments.
- Use the amber exercise treatment and terracotta break treatment from the prototype.
- For paced exercises, make the BPM stepper update the current metronome immediately. Reveal **Save** only after divergence, and persist by `sourceExerciseId` when tapped.
- For open-ended exercises, show elapsed time with a static ring; paced open-ended exercises continue the metronome until Finish/Skip.
- Wire Pause/Resume, Finish/Skip, break Rewind, and Back to the existing lifecycle. Back exits immediately and relies on unmount cleanup.
- Replace Stop with a slider that must reach its threshold before dispatching stop; reset it if released early and provide an equivalent keyboard interaction.
- Style routine-complete, session-stopped, interrupted/background-paused, and audio-unavailable states consistently with the new screens.

### 5. Verification and hardening

- Add component tests for sheet add/edit validation, deletion undo, reorder callbacks, BPM divergence/save behavior, open-ended elapsed display, rewind, Back, and the stop slider threshold.
- Run the existing domain, persistence, audio, and session suites, then run formatting, lint, and production build.
- Manually verify touch dragging, slider stopping, timer progress, metronome tempo changes, background interruption, wake lock, safe areas, offline launch, and installed-PWA behavior on a narrow phone viewport.
- Compare final editor, exercise, and break screenshots against the measurements and tokens in this plan; document any intentional deviations.

## Suggested delivery slices

1. Theme, app frame, and reusable visual primitives.
2. Four-mode domain/audio/session behavior with tests.
3. Routine editor cards, sheets, persistence, and drag reorder.
4. Live exercise/break screens, tempo save, rewind, and slide-to-stop.
5. Completion/error states, accessibility pass, responsive polish, and full verification.

## Definition of done

- The main app—not the standalone design mock—matches the supplied editor, exercise, and break layouts.
- Every visible control works with real persisted/session state; no demo switcher, mock values, or dead buttons remain.
- Existing offline, audio, timer, persistence, wake-lock, and visibility behavior still passes its tests.
- Paced open-ended exercises, temporary BPM changes with explicit save, rewind, drag reorder, and slide-to-stop work on touch and keyboard.
