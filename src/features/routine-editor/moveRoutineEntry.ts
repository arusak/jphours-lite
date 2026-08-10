import type { RoutineEntry } from '../../domain/routine'

/** Moves one Routine entry over another without coupling the transition to rendered indexes. */
export function moveRoutineEntry(
  entries: readonly RoutineEntry[],
  activeEntryId: string,
  targetEntryId: string,
): RoutineEntry[] {
  const activeIndex = entries.findIndex(({ id }) => id === activeEntryId)
  const targetIndex = entries.findIndex(({ id }) => id === targetEntryId)
  if (activeIndex < 0 || targetIndex < 0 || activeIndex === targetIndex) return [...entries]

  const reordered = [...entries]
  const [activeEntry] = reordered.splice(activeIndex, 1)
  reordered.splice(targetIndex, 0, activeEntry!)
  return reordered
}

/** Resolves dnd-kit's projected sortable position back to a stable Routine entry ID. */
export function targetRoutineEntryId(
  entries: readonly RoutineEntry[],
  projectedIndex: number,
): string {
  return entries[projectedIndex]?.id ?? ''
}
