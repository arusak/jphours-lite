# Plan: Estimate Session Title Font Size from Container Width

Date: 2026-10-01

Status: Ready for implementation

## Scope and non-goals

Replace measured text fitting for the Current phase title with the approved width-based estimate. The reported case is the Exercise name `Любой рудимент` in an up-to-date Chromium-installed PWA on Realme 8. Short names should remain large; longer names should receive intermediate sizes as available width changes.

Do not change Session progression, Routine data, typography elsewhere, Timer Ring layout, PWA update handling, or the `SessionTitle` props. Do not add a dependency, font files, a reusable fitting abstraction, character-specific weights, or runtime text measurements. Exact fitting for every possible font and string is outside the accepted heuristic's guarantees.

## Acceptance contract

- Let `W` be the title container's content-box inline size in CSS pixels, and `N = max(1, Array.from(title).length)` be the number of Unicode code points in the supplied title, including spaces.
- Estimate the font size as `max(16, min(48, W / (0.6 * N)))` CSS pixels. The coefficient is `0.6`; the bounds are `16px` and `48px`.
- For a fixed title, the size changes linearly with container width between the bounds. Title length appears in the denominator; this is not a linear function of title length.
- `Любой рудимент` has 14 code points. At container widths `312px`, `342px`, and `364px`, the expected sizes are approximately `37.14px`, `40.71px`, and `43.33px`. These widths are verification fixtures, not inferred measurements of the user's screenshot.
- Short names whose estimate exceeds `48px` use `48px`. Very long names whose estimate falls below `16px` use `16px`. Empty input must not cause division by zero or invalid CSS.
- Preserve the exact title text and semantic `h1`. Count the title as supplied; do not trim, normalize, rewrite, or truncate its DOM text.
- Preserve the `56px` title area, current line height, letter spacing, centering, balanced wrapping, and `overflow-wrap: anywhere`. Keep overflow contained and retain a three-line clamp as a static safeguard. This is an approximate policy: wrapping and clipping protect surrounding layout, not a guarantee that every arbitrary title is entirely visible.
- The reported name must be legible at an intermediate size on the actual Realme 8 PWA, with no clipping in that fixture. Short names must retain their larger size.
- Changes of Current phase or title recalculate only the character-derived input during React rendering. Container resize, orientation change, and returning from a hidden state are handled by CSS without an observer, timer, animation frame, or cached dimensions.
- Pause, Resume, Quick Rest, Break, navigation, and Session timing remain unchanged. `Break` and `Quick Rest` use the same title-sizing policy through the existing caller.

## Diagnosis and evidence

### Current flow and ownership

`src/features/session-player/SessionPlayer/SessionPlayer.tsx` derives the Current phase title and passes it to `SessionTitle` inside `.sessionHeading`. `src/features/session-player/SessionPlayer.module.css` supplies the Session's capped width and horizontal padding.

`src/features/session-player/SessionTitle/SessionTitle.tsx` owns `fitSessionTitle`, a binary search between `16px` and `48px`. It repeatedly sets an inline font size and accepts it only when `scrollHeight <= clientHeight`. A layout effect runs on each title change; a `ResizeObserver` watches the parent. If the minimum still overflows, it applies a line clamp.

`src/features/session-player/SessionTitle/SessionTitle.module.css` defines a fixed-height, full-width legacy `-webkit-box` with balanced wrapping. The measurement predicate checks vertical scrollable overflow, not text width directly.

### Confirmed facts

- The user supplied the name, device, PWA installation method, confirmed the installed version is current, and supplied a screenshot showing a small single-line title with substantial unused horizontal space.
- The screenshot establishes the visible symptom; it does not establish the exact CSS font size, CSS viewport width, device pixel ratio, or computed font metrics.
- Desktop Chrome and Chromium mobile emulation did not reproduce the reported shrinkage. The old function returned intermediate sizes for the supplied name, including about `39.96px` at a `312px` heading width in the local font environment.
- The existing focused command was run during investigation: `pnpm exec vitest run src/features/session-player/tests/SessionTitle.test.tsx`. All four tests passed. This was a green baseline, not reproduction of the Android bug.
- Existing Vitest tests supply an artificial monotonic `scrollHeight` threshold; they do not exercise actual Android layout, font metrics, or balanced wrapping.
- No application code, tests, configuration, dependencies, or Git state were changed during planning.

### Hypotheses, confidence, and feedback gaps

The device-specific root cause remains unconfirmed. Font metrics, Android text scaling, or the interaction of wrapped layout with the overflow predicate are possible mechanisms, not established diagnoses. A simple device-pixel/CSS-pixel unit mismatch is unsupported: both DOM height APIs use CSS pixels. Rounding alone also does not establish the reported large reduction.

Confidence is high in the confirmed visible symptom and the current ownership/measurement path. Confidence is low in any particular Android mechanism. There is no agent-runnable reproduction that goes red on the actual Realme symptom; temporary desktop/mobile browser harnesses remained green and were removed. The actual-device browser gate below remains mandatory.

The user explicitly chose to replace measured fitting with a predictable static estimate rather than wait for a device-specific measurement diagnosis. Implementation does not depend on identifying that underlying browser mechanism. It must prove that the new title no longer calls the old measurement path and that the new visual behavior works on Realme.

### Primary-source findings

- [CSSOM View: CSS pixels](https://drafts.csswg.org/cssom-view/#css-pixels) specifies the units of the DOM geometry APIs.
- [Inter issue 602](https://github.com/rsms/inter/issues/602) records `scrollHeight` exceeding a requested line height for another font. It demonstrates a measurement limitation; it is not an Android or Realme reproduction.
- [Chrome text wrapping documentation](https://developer.chrome.com/docs/css-ui/css-text-wrap-balance) describes balanced wrapping as a wrapping policy that does not shrink the containing element's width.
- [Blink TextAutosizer implementation](https://chromium.googlesource.com/chromium/src.git/+/d6d3fd09c9dbd1bc9d0f48b291b41211d8e0cda9/third_party/blink/renderer/core/layout/text_autosizer.cc) documents text inflation and fixed-height suppression. Its historical implementation is evidence of mechanisms, not proof of the user's current browser behavior.
- [CSS container-relative lengths](https://www.w3.org/TR/css-contain-3/#container-lengths) defines `cqi` relative to an eligible ancestor container's inline size. The title must have an explicitly established ancestor container.

## Confirmed design

- Keep title text, code-point counting, and the numeric CSS input inside the existing `SessionTitle` module. Keep the public interface `SessionTitle({ title })` unchanged.
- Establish `container-type: inline-size` on the existing `.sessionHeading` ancestor. Its width already comes from the Session layout; do not put containment on the `h1` itself or introduce a wrapper.
- In `SessionTitle`, compute `0.6 * Math.max(1, Array.from(title).length)` and supply it as the numeric CSS custom property `--title-width-factor`. Use the normal React `CSSProperties` typing for the custom property.
- In `.title`, use `font-size: clamp(16px, calc(100cqi / var(--title-width-factor)), 48px)`. This keeps all width adaptation in CSS. Do not multiply or divide by device pixel ratio.
- Retain a measurement-free viewport fallback before the container-unit declaration, using the same clamp and denominator with `100vw`. It is a compatibility safeguard, not the primary sizing input; a fallback browser may wrap earlier because viewport width includes outer padding.
- Remove `fitSessionTitle`, its constants that become unused, the heading ref, layout effect, and `ResizeObserver`. No hook or separate size-calculation utility replaces them.
- Set the three-line clamp in CSS instead of dynamically calculating it. Keep the existing fixed height and overflow behavior; do not add DOM-based wrap detection.
- Add one `ponytail:` comment at the estimate explaining the ceiling: average-width approximation can misestimate wide glyphs or multi-code-point graphemes; revisit fitting only if observed clipping makes the heuristic insufficient.
- There is no persistent sizing state. The denominator is derived on each render, and browser CSS resolves the current container width. No new Session, Routine, or persistence state is introduced.

## Execution plan

### 1. Write focused red regressions

File: `src/features/session-player/tests/SessionTitle.test.tsx`

- Replace the old artificial overflow-threshold tests with tests against the unchanged `SessionTitle` rendering interface.
- Assert that `Любой рудимент` renders as an `h1` with the full text and supplies a width factor close to `8.4`.
- Rerender with a short and then a longer title; assert the factor changes from the new text without stale inline pixel sizing.
- Cover empty input's denominator guard and a supplementary Unicode character such as `🎵`, which must count as one code point rather than two UTF-16 code units.
- Make geometry accessors such as `scrollHeight` and `clientHeight` fail if read while rendering/rerendering, and assert no `ResizeObserver` is constructed. Restore spies after each test. These regressions must fail against the old effect-driven fitter.
- Run the focused command and record the red failures before editing production code. These tests protect the new measurement-free contract; do not present them as reproduction of the old Android rendering problem.
- Do not ask jsdom to verify computed `cqi` font sizes. Real-browser verification owns the CSS calculation.

### 2. Replace imperative fitting and supply the container

Files: `src/features/session-player/SessionTitle/SessionTitle.tsx`, `src/features/session-player/SessionTitle/SessionTitle.module.css`, `src/features/session-player/SessionPlayer.module.css`

- Add the local character-derived CSS input and remove the complete imperative fitting lifecycle from `SessionTitle.tsx`.
- Add inline-size containment to the existing `.sessionHeading` rule. Preserve its flex layout and its Duration child.
- Replace the static preferred font declaration with the bounded viewport fallback followed by the container-width formula. Keep the preferred maximum at `48px` and the minimum at `16px`.
- Make overflow clamping static while retaining existing wrapping, fixed height, and full text in the DOM.
- Add the approximation comment. Do not add runtime correction, character classes, a font-measurement library, or a new prop.
- `SessionPlayer.tsx` requires no caller change: it already supplies every Current phase title through this module.

### 3. Verify behavior and record the decision

Files: `docs/adr/0008-container-estimated-session-title.md` (new during implementation), `docs/adr.json`, `docs/files.json`

- Record the accepted estimate, limits, deliberate approximation, and removal of runtime geometry fitting in a short ADR. Add it to `docs/adr.json`.
- Update the existing `SessionTitle/` inventory description to describe container-width estimation and bounded overflow. Existing `docs/adr/` and `docs/plans/` directory entries cover their contents; do not add individual document entries.
- No generated code, dependencies, Routine schema, or domain vocabulary changes are required.
- Complete the gates below and record their actual outcomes in the implementation handoff. No additional report or manual-test document is required for this small change.

## Verification

### Focused red/green and adjacent gates

```sh
pnpm exec vitest run src/features/session-player/tests/SessionTitle.test.tsx
pnpm exec vitest run src/features/session-player/tests/SessionPlayer.test.tsx src/features/session-player/tests/sessionPlayerParts.test.tsx
pnpm lint
pnpm format:check
pnpm build
pnpm test
```

The focused tests protect text, safe code-point counting, rerender behavior, and absence of imperative measurements. Adjacent tests protect the existing title caller and Session UI. Record any unrelated baseline failure separately. Full-suite, static, and build gates have not been run for this plan and must not be described as passed.

### Real-browser CSS gate

Run `pnpm dev` and open the Session UI at `/jphours-lite/`. Browser automation or DevTools may measure geometry for verification; production sizing must not.

- Verify `CSS.supports('container-type', 'inline-size')` and `CSS.supports('font-size', '1cqi')` in the test browser. Confirm the heading uses `.sessionHeading` as its eligible ancestor, not the viewport by accidental fallback.
- For `Любой рудимент`, vary that ancestor's content width through `312px`, `342px`, and `364px`. Assert computed font sizes match the contract within `0.1px` and stay strictly between `16px` and `48px`.
- Confirm changing container width while keeping viewport width fixed changes the font size. This catches accidentally using viewport units as the primary formula.
- Verify a short title such as `Break` reaches `48px`, and a sufficiently long title reaches `16px`. Verify a middle-size title visibly retains an intermediate size.
- Advance between short/long Exercise steps, Break, and Quick Rest. Resize, rotate, and hide/restore the page. Confirm the title follows the current text and width without an observer, stale state, or overflow into Duration/Timer Ring.
- Check long spaced text, an unbroken string, and unusually wide glyphs. Fixed-height containment must protect adjacent UI; report approximate fitting limitations honestly rather than claiming universal complete-text visibility.

### Actual Realme 8 PWA gate

- Use the current installed PWA and the same Routine/Exercise shown in the user's screenshot. Accept any implementation update from the Routine Editor using the existing update flow; do not reset local data or interrupt an active Session to force it.
- Start a Session with `Любой рудимент`. Confirm its visible size is larger and proportional to the available container width, with no clipping of this name. Compare with the supplied screenshot.
- Confirm short names remain larger, and names of increasing length show intermediate sizes before reaching the minimum.
- Check portrait/landscape and the user's normal text/display scaling. Confirm wrapping remains bounded and Duration and Timer Ring layout stay intact.
- This gate is pending until performed on the physical device. Desktop emulation alone cannot close it. No server or backend gate is needed; this is local presentation logic.

## Risks and completion criteria

The approved average-width estimate does not model individual glyph widths or grapheme clusters. Wide glyphs can wrap at a size above the minimum; multi-code-point emoji may be conservatively undersized. The static three-line clamp and fixed height are layout safeguards, not proof of perfect text fit. These are accepted limits of the requested heuristic. Do not reintroduce measurement as an unapproved correction.

Container containment changes intrinsic inline sizing. The existing stretched `.sessionHeading` must retain its allocated width and must not collapse. The real-browser width test is the gate for this risk. Old browsers using the viewport fallback may produce a less accurate estimate; the actual installed Chromium must pass the container-unit gate.

Implementation is complete only when:

- The approved formula, coefficient, bounds, safe denominator, and exact title text are in place.
- The old fitter, geometry reads, layout effect, ref, and observer are removed from `SessionTitle`.
- Container-only width changes produce the expected intermediate sizes in a real browser.
- The reported name passes the physical Realme PWA check; its original screenshot remains evidence of the pre-change symptom, not an exact CSS measurement.
- Fixed-height containment and the existing Session behavior remain intact.
- Focused and adjacent tests, lint, formatting, build, and full-suite outcomes are recorded accurately.
- The ADR and indexes reflect the final implementation, and remaining heuristic limitations are disclosed.

Planning-session status: only this approved plan file is added. Production code remains untouched; the actual-device reproduction/root cause and post-implementation gates remain unverified.
