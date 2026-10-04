import * as z from 'zod/mini'
import { v4 as uuidv4 } from 'uuid'
import { practiceConfig } from '../../config/practice-config'
import {
  createExercise,
  createRoutine,
  ROUTINE_SCHEMA_VERSION,
  type Routine,
} from '../../domain/routine'
import { normalizeExerciseName, normalizeRoutineName } from '../../domain/name-normalization'
import {
  breakDurationSchema,
  exerciseDurationSchema,
  metronomeSoundSchema,
  quickRestDurationSchema,
  routineSchema,
  tempoSchema,
  warningLeadTimeSchema,
} from '../../domain/routine-schema'

export const ROUTINE_STORAGE_KEY = 'rhythm-practice-trainer/routine'
export const ROUTINES_STORAGE_KEY = 'rhythm-practice-trainer/routines'
export const ROUTINE_MAX_COUNT = 100

export interface RoutineCollection {
  storageVersion: 1
  selectedRoutineId: string
  routines: { routine: Routine; lastAccessedAt: string }[]
}

export interface RoutineRepository {
  loadCollection(): RoutineCollection
  select(id: string): Routine
  add(routine: Routine): RoutineCollection
  remove(id: string): RoutineCollection
  load(id?: string): Routine
  save(routine: Routine): void
}

const ingressIdSchema = z.string()
const ingressExerciseSchema = z.looseObject({
  id: ingressIdSchema,
  kind: z.literal('exercise'),
  title: z.string(),
  tempoBpm: z.nullable(tempoSchema),
  durationSec: z.nullable(exerciseDurationSchema),
})
const ingressBreakSchema = z.looseObject({
  id: ingressIdSchema,
  kind: z.literal('break'),
  durationSec: breakDurationSchema,
})
const currentRoutineIngressSchema = z.looseObject({
  schemaVersion: z.literal(ROUTINE_SCHEMA_VERSION),
  id: ingressIdSchema,
  name: z.string(),
  entries: z.array(z.discriminatedUnion('kind', [ingressExerciseSchema, ingressBreakSchema])),
  quickRestDurationSec: quickRestDurationSchema,
  warningLeadTimeSec: warningLeadTimeSchema,
  metronomeSound: metronomeSoundSchema,
  alternateBeatTone: z.optional(z.boolean()),
  updatedAt: z.iso.datetime({ precision: 3 }).check(z.length(24)),
})
const legacyExerciseSchema = z.looseObject({
  id: ingressIdSchema,
  title: z.string(),
  tempoBpm: z.nullable(tempoSchema),
  durationSec: z.nullable(exerciseDurationSchema),
})
const legacyRoutineIngressSchema = z.looseObject({
  schemaVersion: z.literal(1),
  id: ingressIdSchema,
  name: z.string(),
  exercises: z.array(legacyExerciseSchema).check(z.minLength(1)),
  defaultBreakDurationSec: quickRestDurationSchema,
  warningLeadTimeSec: warningLeadTimeSchema,
  updatedAt: z.iso.datetime({ precision: 3 }).check(z.length(24)),
})

/** The only place persisted schema compatibility is decided. */
export function migrateRoutine(value: unknown): Routine {
  return parseRoutine(value) ?? createRoutine()
}

function parseRoutine(value: unknown): Routine | undefined {
  const current = z.safeParse(currentRoutineIngressSchema, value)
  if (current.success) {
    const migrated = {
      schemaVersion: ROUTINE_SCHEMA_VERSION,
      id: validIdOrFresh(current.data.id),
      name: normalizeRoutineName(current.data.name),
      entries: current.data.entries.map((entry) => ({
        ...entry,
        id: validIdOrFresh(entry.id),
        ...(entry.kind === 'exercise' ? { title: normalizeExerciseName(entry.title) } : {}),
      })),
      quickRestDurationSec: current.data.quickRestDurationSec,
      warningLeadTimeSec: current.data.warningLeadTimeSec,
      metronomeSound: current.data.metronomeSound,
      alternateBeatTone: current.data.alternateBeatTone ?? true,
      updatedAt: current.data.updatedAt,
    }
    const parsed = z.safeParse(routineSchema, migrated)
    return parsed.success ? parsed.data : undefined
  }

  const legacy = z.safeParse(legacyRoutineIngressSchema, value)
  if (legacy.success) {
    const migrated = createRoutine({
      id: validIdOrFresh(legacy.data.id),
      name: normalizeRoutineName(legacy.data.name),
      entries: legacy.data.exercises.map((exercise) =>
        createExercise({
          id: validIdOrFresh(exercise.id),
          title: normalizeExerciseName(exercise.title),
          tempoBpm: exercise.tempoBpm,
          durationSec: exercise.durationSec,
        }),
      ),
      quickRestDurationSec: legacy.data.defaultBreakDurationSec,
      warningLeadTimeSec: legacy.data.warningLeadTimeSec,
      metronomeSound: practiceConfig.metronome.defaultSound,
      alternateBeatTone: true,
      updatedAt: legacy.data.updatedAt,
    })
    const parsed = z.safeParse(routineSchema, migrated)
    return parsed.success ? parsed.data : undefined
  }
  return undefined
}

export class LocalStorageRoutineRepository implements RoutineRepository {
  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage,
  ) {}
  loadCollection(): RoutineCollection {
    const saved = this.storage.getItem(ROUTINES_STORAGE_KEY)
    if (saved !== null) return parseCollection(JSON.parse(saved))

    const legacy = this.storage.getItem(ROUTINE_STORAGE_KEY)
    let routine: Routine
    try {
      routine = legacy === null ? createRoutine() : migrateRoutine(JSON.parse(legacy))
    } catch {
      routine = createRoutine()
    }
    return this.write({
      storageVersion: 1,
      selectedRoutineId: routine.id,
      routines: [{ routine, lastAccessedAt: new Date().toISOString() }],
    })
  }

  load(id?: string): Routine {
    const collection = this.loadCollection()
    return this.find(collection, id ?? collection.selectedRoutineId).routine
  }

  save(routine: Routine): void {
    const collection = this.loadCollection()
    this.find(collection, routine.id).routine = routineSchema.parse(routine)
    this.write(collection)
  }

  select(id: string): Routine {
    const collection = this.loadCollection()
    const record = this.find(collection, id)
    record.lastAccessedAt = new Date().toISOString()
    collection.selectedRoutineId = id
    this.write(collection)
    return record.routine
  }

  add(routine: Routine): RoutineCollection {
    const collection = this.loadCollection()
    if (collection.routines.length >= ROUTINE_MAX_COUNT) {
      throw new Error('You can save up to 100 routines. Delete a routine to add another.')
    }
    if (collection.routines.some((record) => record.routine.id === routine.id)) {
      throw new Error('A routine with this ID already exists.')
    }
    collection.routines.push({
      routine: routineSchema.parse(routine),
      lastAccessedAt: new Date().toISOString(),
    })
    collection.selectedRoutineId = routine.id
    return this.write(collection)
  }

  remove(id: string): RoutineCollection {
    const collection = this.loadCollection()
    this.find(collection, id)
    collection.routines = collection.routines.filter((record) => record.routine.id !== id)
    if (collection.routines.length === 0) {
      const routine = createRoutine()
      collection.routines.push({ routine, lastAccessedAt: new Date().toISOString() })
      collection.selectedRoutineId = routine.id
    } else if (collection.selectedRoutineId === id) {
      const record = mostRecent(collection.routines)
      collection.selectedRoutineId = record.routine.id
      record.lastAccessedAt = new Date().toISOString()
    }
    return this.write(collection)
  }

  private find(collection: RoutineCollection, id: string) {
    const record = collection.routines.find((record) => record.routine.id === id)
    if (!record) throw new Error('This routine is no longer saved. Reload and try again.')
    return record
  }

  private write(collection: RoutineCollection): RoutineCollection {
    this.storage.setItem(ROUTINES_STORAGE_KEY, JSON.stringify(collection))
    return collection
  }
}

function validIdOrFresh(id: string): string {
  return z.safeParse(z.uuid(), id).success ? id : uuidv4()
}

const collectionIngressSchema = z.object({
  storageVersion: z.literal(1),
  selectedRoutineId: z.string(),
  routines: z
    .array(
      z.object({
        routine: z.unknown(),
        lastAccessedAt: z.iso.datetime({ precision: 3 }).check(z.length(24)),
      }),
    )
    .check(z.minLength(1), z.maxLength(ROUTINE_MAX_COUNT)),
})

function parseCollection(value: unknown): RoutineCollection {
  const parsed = z.safeParse(collectionIngressSchema, value)
  if (!parsed.success)
    throw new Error('Saved routines could not be read. Repair storage and retry.')
  const ids = new Set<string>()
  const routines = parsed.data.routines.map((record) => {
    const routine = parseRoutine(record.routine)
    if (!routine || ids.has(routine.id)) {
      throw new Error(
        'Saved routines contain an invalid or duplicate routine. Repair storage and retry.',
      )
    }
    ids.add(routine.id)
    return { routine, lastAccessedAt: record.lastAccessedAt }
  })
  return {
    storageVersion: 1,
    selectedRoutineId: ids.has(parsed.data.selectedRoutineId)
      ? parsed.data.selectedRoutineId
      : mostRecent(routines).routine.id,
    routines,
  }
}

function mostRecent(routines: RoutineCollection['routines']) {
  return routines.reduce((latest, record) =>
    record.lastAccessedAt > latest.lastAccessedAt ? record : latest,
  )
}
