# Routine File Refactor Implementation Report

## Result

The pending Routine import/export work was reorganized around three explicit seams: domain validation, persisted-data migration, and Routine file transfer. Existing version 1 file behavior and editor UX remain intact while stale-save and validation-feedback inconsistencies were fixed.

## Changes

- Kept Routine types and factories in the core domain module; moved name normalization and Zod runtime schemas into focused modules.
- Made `validateRoutine` the authoritative validity result for editor actions and user-facing errors.
- Replaced manual persistence shape checks with tolerant Zod ingress schemas followed by strict domain validation.
- Centralized the Routine file transfer shape and domain conversions behind the serialize/parse/filename interface.
- Split browser file handling and preview state from `RoutineFileActions` presentation.
- Added debounced-save cancellation so a pending edit cannot overwrite a confirmed imported Routine.

## Verification

- Focused tests were developed at the domain validation, migration, file-codec, debounced-save, and Routine editor DOM seams.
- Parallel implementation agents handled domain/persistence, file-codec, and editor UI work; the integrated result was reviewed and verified from the repository root.
- `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm build`, and `git diff --check` pass.
