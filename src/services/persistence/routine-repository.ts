import {
  createRoutine,
  ROUTINE_SCHEMA_VERSION,
  type Exercise,
  type Routine,
} from '../../domain/routine'
import { practiceConfig } from '../../config/practice-config'

export const ROUTINE_STORAGE_KEY = 'rhythm-practice-trainer/routine'
export interface RoutineRepository {
  load(): Routine
  save(routine: Routine): void
}

type LegacyRoutine = {
  schemaVersion: 1
  id: string
  name: string
  exercises: Omit<Exercise, 'kind'>[]
  defaultBreakDurationSec: number
  warningLeadTimeSec: number
  autoAdvance: true
  updatedAt: string
}

/** The only place persisted schema compatibility is decided. */
export function migrateRoutine(value: unknown): Routine {
  if (isCurrentRoutine(value))
    return { ...value, alternateBeatTone: value.alternateBeatTone ?? true }
  if (isLegacyRoutine(value))
    return createRoutine({
      id: value.id,
      name: value.name,
      entries: value.exercises.map((exercise) => ({ ...exercise, kind: 'exercise' })),
      quickRestDurationSec: value.defaultBreakDurationSec,
      warningLeadTimeSec: value.warningLeadTimeSec,
      metronomeSound: practiceConfig.metronome.defaultSound,
      alternateBeatTone: true,
      autoAdvance: value.autoAdvance,
      updatedAt: value.updatedAt,
    })
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

function isCurrentRoutine(value: unknown): value is Routine {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<Routine>
  return (
    candidate.schemaVersion === ROUTINE_SCHEMA_VERSION &&
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.entries) &&
    typeof candidate.quickRestDurationSec === 'number' &&
    typeof candidate.warningLeadTimeSec === 'number' &&
    typeof candidate.metronomeSound === 'string' &&
    (candidate.alternateBeatTone === undefined ||
      typeof candidate.alternateBeatTone === 'boolean') &&
    candidate.autoAdvance === true &&
    typeof candidate.updatedAt === 'string'
  )
}
function isLegacyRoutine(value: unknown): value is LegacyRoutine {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<LegacyRoutine>
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.exercises) &&
    typeof candidate.defaultBreakDurationSec === 'number' &&
    typeof candidate.warningLeadTimeSec === 'number' &&
    candidate.autoAdvance === true &&
    typeof candidate.updatedAt === 'string'
  )
}
