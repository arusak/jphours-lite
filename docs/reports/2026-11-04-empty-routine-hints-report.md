# Empty Routine hints implementation report

## 1. What was the task?

Implement the labelled arrows described in `docs/plans/2026-11-04-empty-routine-hints-plan.md` for Routines whose saved entries match the blank creation template.

## 2. What was your analysis?

Eligibility belongs at the saved entry boundary: one Practice Exercise with 100 BPM and 300 seconds, regardless of identity, name, settings, or history. Draft forms must not affect it. Geometry must follow explicit DOM refs and react to layout changes; visibility of an individual target is separate from content eligibility. Existing footer and sheet stacking levels are 5 and 20, respectively.

## 3. What changes were made?

- Shared the blank Exercise content between creation and eligibility while retaining independent generated IDs.
- Added passive labels and currentColor curved arrows, explicit control refs, and a dedicated geometry hook.
- Added focused factory, editor lifecycle, and geometry coverage.
- Recorded ADR 0011, updated the repository inventory, and added a manual test guide.

## Verification and limitations

Commands executed: focused Vitest factory/editor/geometry tests, `pnpm exec tsc -b`, `pnpm test`, `pnpm lint`, `pnpm build`, and `pnpm format:check`. The full suite passed 225 tests across 21 files. Lint completed with three pre-existing unused import/parameter warnings in WelcomeScreen (RoutineFileActions, importDisabled, onImport). Build and formatting checks passed. A final geometry refinement received focused re-verification.

The Ponytail review identified a dense-layout fallback that could obscure Exercise metadata. The final refinement avoids this placement; review of content eligibility, ref forwarding, focus, and storage/Session compatibility found no further issues. Manual visual verification was not executed: this session exposes no browser automation tools. The viewport matrix, text scaling, actual arrow alignment, label overlap, pointer/touch pass-through, keyboard order, and sheet stacking remain pending as documented in `2026-11-04-empty-routine-hints-manual-test.md`. DOM tests are not visual proof.

No dependencies, persisted onboarding flags, storage formats, or Session behavior changes were needed. Visual geometry remains the principal acceptance risk until those manual checks are completed.

## Dense-layout deviation

When there is insufficient safe space below the card or between settings and the card, annotations temporarily hide even if their controls are visible. This avoids covering Exercise content or controls, but deviates from the plan’s requirement to annotate every visible target. Validate the viewport matrix before treating visual acceptance as complete. Final review found no remaining concrete code blocker with this limitation recorded.
