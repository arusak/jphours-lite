# Small-caps BPM implementation report

- Added the global `.small-caps` utility using `font-variant-caps: all-small-caps`.
- Rendered the BPM unit through that utility in the Routine editor, Routine entry cards, Session timer, next-step metadata, and Now Playing metadata.
- Updated focused coverage to assert the class while preserving existing visible metadata content.

## Verification

- `pnpm test` (131 tests)
- `pnpm lint` (passes with one pre-existing unused-parameter warning)
- `pnpm build`
