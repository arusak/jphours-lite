import { describe, expect, it } from 'vitest'
import { createBreak, createExercise } from '../../../domain/routine'
import { moveRoutineEntry, targetRoutineEntryId } from '../moveRoutineEntry'

describe('moveRoutineEntry', () => {
  it('moves Exercises and Breaks by their stable Routine entry IDs', () => {
    const scales = createExercise({ id: 'scales', title: 'Scales' })
    const breakEntry = createBreak({ id: 'break' })
    const arpeggios = createExercise({ id: 'arpeggios', title: 'Arpeggios' })
    const entries = [scales, breakEntry, arpeggios]

    expect(moveRoutineEntry(entries, 'arpeggios', 'scales')).toEqual([
      arpeggios,
      scales,
      breakEntry,
    ])
    expect(moveRoutineEntry(entries, 'scales', 'arpeggios')).toEqual([
      breakEntry,
      arpeggios,
      scales,
    ])
  })

  it('does not mutate or rearrange entries for an invalid or unchanged move', () => {
    const entries = [createExercise({ id: 'one' }), createBreak({ id: 'two' })]

    expect(moveRoutineEntry(entries, 'missing', 'two')).toEqual(entries)
    expect(moveRoutineEntry(entries, 'one', 'one')).toEqual(entries)
    expect(entries.map(({ id }) => id)).toEqual(['one', 'two'])
  })

  it('resolves the dnd-kit Keyboard sensor projected index to a stable entry ID', () => {
    const entries = [createExercise({ id: 'one' }), createBreak({ id: 'two' })]

    expect(targetRoutineEntryId(entries, 1)).toBe('two')
    expect(targetRoutineEntryId(entries, -1)).toBe('')
    expect(targetRoutineEntryId(entries, 4)).toBe('')
  })
})
