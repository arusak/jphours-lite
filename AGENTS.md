# Agent Guide

## Navigation

Start with [the repository inventory](docs/files.json). It maps standalone files and cohesive directories to their responsibilities so agents can locate the appropriate module before editing.

## Working conventions

- Preserve the domain vocabulary in `docs/UBIQUITOUS_LANGUAGE.md`.
- Keep React hooks and components in their dedicated feature files.
- Keep reusable UI icons in `src/components/Icons/Icons.tsx`; SVG icon paths must use `currentColor`.
- Add or update focused Vitest coverage for behaviour changes.
- Update the inventory after files or directories are added or removed. Use directory entries for components, subcomponents, and other cohesive modules; only add a file entry when it is useful as a standalone navigation target.
