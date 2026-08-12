import { practiceConfig, type MetronomeSound } from '../config/practice-config'

export const ROUTINE_SCHEMA_VERSION = 2 as const

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

const createId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `routine-${Date.now()}-${Math.random().toString(36).slice(2)}`

export function createExercise(overrides: Partial<Omit<Exercise, 'kind'>> = {}): Exercise {
  return {
    id: createId(),
    kind: 'exercise',
    title: 'Exercise',
    tempoBpm: practiceConfig.tempo.default,
    durationSec: practiceConfig.exerciseDuration.default,
    ...overrides,
  }
}

export function createBreak(overrides: Partial<Omit<Break, 'kind'>> = {}): Break {
  return {
    id: createId(),
    kind: 'break',
    durationSec: practiceConfig.breakDuration.default,
    ...overrides,
  }
}

export function createRoutine(overrides: Partial<Routine> = {}): Routine {
  const defaultExercise = createExercise()
  return {
    schemaVersion: ROUTINE_SCHEMA_VERSION,
    id: createId(),
    name: '',
    entries: [defaultExercise],
    quickRestDurationSec: practiceConfig.quickRestDuration.default,
    warningLeadTimeSec: practiceConfig.warningLeadTime.default,
    metronomeSound: practiceConfig.metronome.defaultSound,
    alternateBeatTone: true,
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}
