import { v4 as uuidv4 } from 'uuid'
import { practiceConfig, type MetronomeSound } from '../config/practice-config'

export const ROUTINE_SCHEMA_VERSION = 2 as const
export const ROUTINE_NAME_MAX_LENGTH = 60
export const EXERCISE_NAME_MAX_LENGTH = 60
export const ROUTINE_ENTRY_MAX_COUNT = 1_000
export const DEFAULT_ROUTINE_NAME = 'Practice routine'
export const DEFAULT_EXERCISE_NAME = 'Exercise'

export interface Exercise {
  id: string
  kind: 'exercise'
  title: string
  tempoBpm: number | null
  durationSec: number | null
}

export interface Break {
  id: string
  kind: 'break'
  durationSec: number
}

export type RoutineEntry = Exercise | Break

export interface Routine {
  schemaVersion: typeof ROUTINE_SCHEMA_VERSION
  id: string
  name: string
  entries: RoutineEntry[]
  quickRestDurationSec: number
  warningLeadTimeSec: number
  metronomeSound: MetronomeSound
  alternateBeatTone: boolean
  updatedAt: string
}

export function createExercise(overrides: Partial<Omit<Exercise, 'kind'>> = {}): Exercise {
  return {
    id: uuidv4(),
    kind: 'exercise',
    title: DEFAULT_EXERCISE_NAME,
    tempoBpm: practiceConfig.tempo.default,
    durationSec: practiceConfig.exerciseDuration.default,
    ...overrides,
  }
}

export function createBreak(overrides: Partial<Omit<Break, 'kind'>> = {}): Break {
  return {
    id: uuidv4(),
    kind: 'break',
    durationSec: practiceConfig.breakDuration.default,
    ...overrides,
  }
}

export function createRoutine(overrides: Partial<Routine> = {}): Routine {
  return {
    schemaVersion: ROUTINE_SCHEMA_VERSION,
    id: uuidv4(),
    name: DEFAULT_ROUTINE_NAME,
    entries: [createExercise()],
    quickRestDurationSec: practiceConfig.quickRestDuration.default,
    warningLeadTimeSec: practiceConfig.warningLeadTime.default,
    metronomeSound: practiceConfig.metronome.defaultSound,
    alternateBeatTone: true,
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}
