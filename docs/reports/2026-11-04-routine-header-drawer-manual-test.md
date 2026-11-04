# Routine header and drawer manual test

## Prerequisites

Run `pnpm dev` and open the printed local URL in a disposable browser profile. Export a backup before testing deletion; do not clear real user data. Use valid exported Routine JSON plus malformed, oversized, and unreadable file fixtures. Storage failures require a disposable profile with writes deliberately blocked.

## Steps and expected results

1. At 320px, ordinary mobile, and desktop widths, open short, long, and fallback Routine names. The title wraps, the hamburger stays visible, and Duration precedes the truncated settings summary without horizontal overflow.
2. Activate the title by click, Enter, and Space. Save and Cancel retain existing behavior. Creating from welcome focuses the h1.
3. Expand/collapse settings and change Metronome sound. Duration remains visible, the panel spans the row, values persist, and focus returns correctly. Check empty-Routine hint arrows against the rendered controls.
4. Open Routines. Import and Export appear only here, below New routine, side by side with compact dashed outlines. Tab remains inside the modal. Escape and backdrop dismiss it and restore hamburger focus. Repeat with reduced motion enabled and enough Routines to scroll.
5. Export the selected Routine. Verify the downloaded JSON contains that Routine and the drawer remains open with status. An invalid Routine disables Export and explains why inside the dialog.
6. Cancel the operating-system file picker. The list remains usable. Try malformed, oversized, and unreadable files: errors remain visible in the list.
7. Import a valid file. Exactly one dialog shows preview. Cancel returns focus to Import; repeat and confirm Add routine. The new Routine is selected and the drawer closes. With storage writes blocked, confirmation retains preview and permits retry after writes are restored.
8. At 100 saved Routines, verify New routine and Import are disabled with explanations. Delete one and verify both become available. Check recency ordering, failed deletion, and final-Routine deletion returning to welcome.
9. From an empty collection, import through welcome and verify its existing preview and confirmation flow.

## Recorded outcome

Not performed: this environment exposes no callable browser automation runtime or installed headless browser. Automated DOM tests cover interaction regressions, but do not establish rendered layout, native keyboard activation, file-picker cancellation, downloads, or visual focus containment.

## Cleanup

Remove test downloads and fixtures. Close the disposable profile or clear only its test storage; retain the backup until satisfied. Restore any deliberately blocked storage writes.
