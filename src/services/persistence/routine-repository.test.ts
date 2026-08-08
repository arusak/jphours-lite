import { describe, expect, it } from 'vitest'
import { createRoutine } from '../../domain/routine'
import {
  LocalStorageRoutineRepository,
  migrateRoutine,
  ROUTINE_STORAGE_KEY,
} from './routine-repository'

describe('LocalStorageRoutineRepository', () => {
  it('restores the saved routine', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const repository = new LocalStorageRoutineRepository(storage)
    const routine = createRoutine({ name: 'Warm-up' })
    repository.save(routine)
    expect(repository.load()).toEqual(routine)
    expect(values.has(ROUTINE_STORAGE_KEY)).toBe(true)
  })

  it('migrates legacy exercises without losing their IDs, order, values, or settings', () => {
    const migrated = migrateRoutine({
      schemaVersion: 1,
      id: 'old',
      name: 'Old routine',
      defaultBreakDurationSec: 30,
      warningLeadTimeSec: 20,
      autoAdvance: true,
      updatedAt: '2026-01-01T00:00:00.000Z',
      exercises: [
        { id: 'first', title: 'Scales', tempoBpm: 80, durationSec: 300 },
        { id: 'second', title: 'Free', tempoBpm: null, durationSec: null },
      ],
    })
    expect(migrated).toMatchObject({
      schemaVersion: 2,
      quickRestDurationSec: 30,
      warningLeadTimeSec: 20,
      metronomeSound: 'classic',
    })
    expect(migrated.entries).toEqual([
      { id: 'first', kind: 'exercise', title: 'Scales', tempoBpm: 80, durationSec: 300 },
      { id: 'second', kind: 'exercise', title: 'Free', tempoBpm: null, durationSec: null },
    ])
  })
})
