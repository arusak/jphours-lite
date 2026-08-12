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

  it('migrates legacy exercises with fresh UUIDs without losing order, values, or settings', () => {
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
      alternateBeatTone: true,
    })
    expect(migrated).not.toHaveProperty('autoAdvance')
    expect(migrated.entries).toMatchObject([
      { kind: 'exercise', title: 'Scales', tempoBpm: 80, durationSec: 300 },
      { kind: 'exercise', title: 'Free', tempoBpm: null, durationSec: null },
    ])
    expect(migrated.entries.every((entry) => /^[0-9a-f-]{36}$/i.test(entry.id))).toBe(true)
  })

  it('normalizes saved current Routines without the Alternate beat tone setting to enabled', () => {
    const { alternateBeatTone: _alternateBeatTone, ...savedWithoutSetting } = createRoutine()

    expect(migrateRoutine(savedWithoutSetting)).toMatchObject({ alternateBeatTone: true })
  })

  it('loads old current Routines while removing the obsolete autoAdvance setting', () => {
    const migrated = migrateRoutine({ ...createRoutine(), autoAdvance: true })

    expect(migrated).not.toHaveProperty('autoAdvance')
  })

  it('preserves valid UUIDs while repairing invalid identities and names', () => {
    const saved = createRoutine({ name: '  Warm\nup  ' })
    const validRoutineId = saved.id
    const migrated = migrateRoutine({
      ...saved,
      entries: [{ ...saved.entries[0], id: 'legacy-entry-id', title: '  Scales\t  ' }],
    })

    expect(migrated.id).toBe(validRoutineId)
    expect(migrated.name).toBe('Warm up')
    expect(migrated.entries[0]).toMatchObject({ title: 'Scales' })
    expect(migrated.entries[0].id).not.toBe('legacy-entry-id')
  })

  it('falls back safely when a persisted Routine cannot be repaired', () => {
    const migrated = migrateRoutine({ ...createRoutine({ name: 'Broken' }), entries: [] })

    expect(migrated.name).toBe('Practice routine')
    expect(migrated.entries).toHaveLength(1)
  })
})
