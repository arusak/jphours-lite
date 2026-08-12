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
export interface RoutineRepository {
  load(): Routine
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
    return parsed.success ? parsed.data : createRoutine()
  }

  const legacy = z.safeParse(legacyRoutineIngressSchema, value)
  if (legacy.success) {
    const migrated = createRoutine({
      name: normalizeRoutineName(legacy.data.name),
      entries: legacy.data.exercises.map((exercise) =>
        createExercise({
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
    return parsed.success ? parsed.data : createRoutine()
  }
  return createRoutine()
}

export class LocalStorageRoutineRepository implements RoutineRepository {
  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage,
  ) {}
  load(): Routine {
    try {
      const saved = this.storage.getItem(ROUTINE_STORAGE_KEY)
      return saved === null ? createRoutine() : migrateRoutine(JSON.parse(saved))
    } catch {
      return createRoutine()
    }
  }
  save(routine: Routine): void {
    this.storage.setItem(ROUTINE_STORAGE_KEY, JSON.stringify(routine))
  }
}

function validIdOrFresh(id: string): string {
  return z.safeParse(z.uuid(), id).success ? id : uuidv4()
}
