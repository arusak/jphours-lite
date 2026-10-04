import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRoutine } from '../../domain/routine'
import {
  LocalStorageRoutineRepository,
  migrateRoutine,
  ROUTINE_STORAGE_KEY,
  ROUTINES_STORAGE_KEY,
  ROUTINE_MAX_COUNT,
  type RoutineCollection,
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
    repository.add(routine)
    expect(repository.load()).toEqual(routine)
    expect(values.has(ROUTINES_STORAGE_KEY)).toBe(true)
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

afterEach(() => vi.useRealTimers())

function collectionStorage(collection?: RoutineCollection) {
  const values = new Map<string, string>()
  if (collection) values.set(ROUTINES_STORAGE_KEY, JSON.stringify(collection))
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
  return { values, storage, repository: new LocalStorageRoutineRepository(storage) }
}

function savedCollection(): RoutineCollection {
  const first = createRoutine({ name: 'First' })
  const second = createRoutine({ name: 'Second' })
  return {
    storageVersion: 1,
    selectedRoutineId: first.id,
    routines: [
      { routine: first, lastAccessedAt: '2026-01-01T00:00:00.000Z' },
      { routine: second, lastAccessedAt: '2026-02-01T00:00:00.000Z' },
    ],
  }
}

describe('Routine collection storage', () => {
  it('preserves the legacy backup and valid identities on migration', () => {
    const { values, repository } = collectionStorage()
    const routine = createRoutine({ name: 'Legacy' })
    const raw = JSON.stringify(routine)
    values.set(ROUTINE_STORAGE_KEY, raw)

    expect(repository.load()).toEqual(routine)
    expect(repository.loadCollection().routines).toHaveLength(1)
    expect(values.get(ROUTINE_STORAGE_KEY)).toBe(raw)
    expect(values.has(ROUTINES_STORAGE_KEY)).toBe(true)
  })

  it('repairs a missing selection using recency and stored order for ties', () => {
    const collection = savedCollection()
    collection.selectedRoutineId = 'missing'
    const { repository } = collectionStorage(collection)
    expect(repository.load().name).toBe('Second')
    collection.routines[1].lastAccessedAt = collection.routines[0].lastAccessedAt
    expect(collectionStorage(collection).repository.load().name).toBe('First')
  })

  it('records explicit access without changing content or array order; edits leave access and selection alone', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-04T12:00:00.000Z'))
    const collection = savedCollection()
    const { repository } = collectionStorage(collection)
    const second = collection.routines[1].routine
    expect(repository.load(second.id)).toEqual(second)
    expect(repository.loadCollection()).toEqual(collection)
    expect(repository.select(second.id)).toEqual(second)
    repository.save({ ...collection.routines[0].routine, name: 'Edited' })
    expect(repository.loadCollection()).toMatchObject({
      selectedRoutineId: second.id,
      routines: [
        { routine: { name: 'Edited' }, lastAccessedAt: '2026-01-01T00:00:00.000Z' },
        { routine: second, lastAccessedAt: '2026-10-04T12:00:00.000Z' },
      ],
    })
  })

  it('reads current storage on mutation and rejects missing-ID operations', () => {
    const collection = savedCollection()
    const { repository, values } = collectionStorage(collection)
    repository.loadCollection()
    const removed = collection.routines.pop()!.routine
    values.set(ROUTINES_STORAGE_KEY, JSON.stringify(collection))
    const raw = values.get(ROUTINES_STORAGE_KEY)
    expect(() => repository.save(removed)).toThrow()
    expect(() => repository.load(removed.id)).toThrow()
    expect(() => repository.select(removed.id)).toThrow()
    expect(() => repository.remove(removed.id)).toThrow()
    expect(values.get(ROUTINES_STORAGE_KEY)).toBe(raw)
  })

  it('keeps selection when deleting another Routine and creates a default after deleting the last', () => {
    const collection = savedCollection()
    const { repository } = collectionStorage(collection)
    const result = repository.remove(collection.routines[1].routine.id)
    expect(result.selectedRoutineId).toBe(collection.selectedRoutineId)
    const last = repository.remove(collection.selectedRoutineId)
    expect(last.routines).toHaveLength(1)
    expect(last.routines[0].routine.name).toBe('Practice routine')
    expect(last.routines[0].routine.entries).toHaveLength(1)
    expect(last.selectedRoutineId).toBe(last.routines[0].routine.id)
  })

  it('opens the most recently accessed remaining Routine when deleting the selection', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-04T12:00:00.000Z'))
    const collection = savedCollection()
    const { repository } = collectionStorage(collection)
    const result = repository.remove(collection.selectedRoutineId)
    expect(result.selectedRoutineId).toBe(collection.routines[1].routine.id)
    expect(result.routines[0].lastAccessedAt).toBe('2026-10-04T12:00:00.000Z')
  })

  it('enforces the cap and duplicate-ID rejection without overwriting storage', () => {
    const collection = savedCollection()
    while (collection.routines.length < ROUTINE_MAX_COUNT) {
      collection.routines.push({
        routine: createRoutine(),
        lastAccessedAt: '2026-01-01T00:00:00.000Z',
      })
    }
    const { repository, values } = collectionStorage(collection)
    const raw = values.get(ROUTINES_STORAGE_KEY)
    expect(() => repository.add(createRoutine())).toThrow('100 routines')
    expect(values.get(ROUTINES_STORAGE_KEY)).toBe(raw)
    repository.remove(collection.routines[1].routine.id)
    expect(() => repository.add(collection.routines[0].routine)).toThrow('already exists')
    expect(repository.add(createRoutine()).routines).toHaveLength(100)
  })

  it.each([
    'malformed',
    'unsupported',
    'empty',
    'over-cap',
    'duplicate',
    'invalid-routine',
    'invalid-access',
  ])('preserves %s collection bytes and blocks every mutation until repaired', (kind) => {
    const collection = savedCollection()
    let value: unknown = collection
    if (kind === 'unsupported') value = { ...collection, storageVersion: 2 }
    if (kind === 'empty') collection.routines = []
    if (kind === 'over-cap') {
      collection.routines = Array.from({ length: 101 }, () => ({
        routine: createRoutine(),
        lastAccessedAt: '2026-01-01T00:00:00.000Z',
      }))
    }
    if (kind === 'duplicate') collection.routines[1].routine.id = collection.routines[0].routine.id
    if (kind === 'invalid-routine') collection.routines[0].routine.entries = []
    if (kind === 'invalid-access') collection.routines[0].lastAccessedAt = 'yesterday'
    const raw = kind === 'malformed' ? '{broken' : JSON.stringify(value)
    const { repository, values } = collectionStorage()
    values.set(ROUTINES_STORAGE_KEY, raw)
    expect(() => repository.load()).toThrow()
    expect(() => repository.save(createRoutine())).toThrow()
    expect(() => repository.add(createRoutine())).toThrow()
    expect(() => repository.select('missing')).toThrow()
    expect(() => repository.remove('missing')).toThrow()
    expect(values.get(ROUTINES_STORAGE_KEY)).toBe(raw)
    values.set(ROUTINES_STORAGE_KEY, JSON.stringify(savedCollection()))
    expect(repository.load().name).toBe('First')
  })

  it('does not publish failed mutations, and retries against unchanged storage', () => {
    const collection = savedCollection()
    const { repository, storage, values } = collectionStorage(collection)
    const raw = values.get(ROUTINES_STORAGE_KEY)
    const write = storage.setItem
    storage.setItem = () => {
      throw new Error('Storage full')
    }
    expect(() => repository.select(collection.routines[1].routine.id)).toThrow('Storage full')
    expect(() => repository.add(createRoutine())).toThrow('Storage full')
    expect(() => repository.remove(collection.selectedRoutineId)).toThrow('Storage full')
    expect(() => repository.save({ ...collection.routines[0].routine, name: 'Unsaved' })).toThrow(
      'Storage full',
    )
    expect(repository.loadCollection()).toEqual(collection)
    expect(values.get(ROUTINES_STORAGE_KEY)).toBe(raw)
    storage.setItem = write
    expect(repository.select(collection.routines[1].routine.id).name).toBe('Second')
  })

  it('retains legacy bytes if initialization fails and can retry migration', () => {
    const { repository, storage, values } = collectionStorage()
    const routine = createRoutine()
    const raw = JSON.stringify(routine)
    values.set(ROUTINE_STORAGE_KEY, raw)
    const write = storage.setItem
    storage.setItem = () => {
      throw new Error('Storage unavailable')
    }
    expect(() => repository.load()).toThrow('Storage unavailable')
    expect(values.get(ROUTINE_STORAGE_KEY)).toBe(raw)
    expect(values.has(ROUTINES_STORAGE_KEY)).toBe(false)
    storage.setItem = write
    expect(repository.load()).toEqual(routine)
  })
})
