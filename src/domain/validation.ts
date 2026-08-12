import { practiceConfig } from '../config/practice-config'
import * as z from 'zod/mini'
import {
  EXERCISE_NAME_MAX_LENGTH,
  ROUTINE_ENTRY_MAX_COUNT,
  type Break,
  type Exercise,
  type Routine,
  type RoutineEntry,
} from './routine'
import {
  breakDurationSchema,
  exerciseDurationSchema,
  metronomeSoundSchema,
  quickRestDurationSchema,
  routineSchema,
  tempoSchema,
  warningLeadTimeSchema,
} from './routine-schema'

export const TITLE_MIN_LENGTH = 1
export const TITLE_MAX_LENGTH = EXERCISE_NAME_MAX_LENGTH
export const MIN_TEMPO_BPM = practiceConfig.tempo.min
export const MAX_TEMPO_BPM = practiceConfig.tempo.max
export const MIN_DURATION_SEC = practiceConfig.exerciseDuration.min
export const MAX_DURATION_SEC = practiceConfig.exerciseDuration.max

export type FieldErrors<T extends string> = Partial<Record<T, string>>
export type EntryErrors = FieldErrors<'title' | 'tempoBpm' | 'durationSec'>

export function validateExercise(exercise: Exercise): EntryErrors {
  const errors: EntryErrors = {}
  if (exercise.title.trim().length < TITLE_MIN_LENGTH) errors.title = 'Enter an exercise name.'
  else if (exercise.title.length > TITLE_MAX_LENGTH) errors.title = 'Use at most 60 characters.'
  if (exercise.tempoBpm !== null && !z.safeParse(tempoSchema, exercise.tempoBpm).success)
    errors.tempoBpm = `Use a tempo from ${MIN_TEMPO_BPM} to ${MAX_TEMPO_BPM} BPM.`
  if (
    exercise.durationSec !== null &&
    !z.safeParse(exerciseDurationSchema, exercise.durationSec).success
  )
    errors.durationSec = 'Enter a duration in the configured range.'
  return errors
}

export function validateBreak(entry: Break): EntryErrors {
  const errors: EntryErrors = {}
  if (!z.safeParse(breakDurationSchema, entry.durationSec).success)
    errors.durationSec = 'Enter a break duration in the configured range.'
  return errors
}

export function validateEntry(entry: RoutineEntry): EntryErrors {
  return entry.kind === 'exercise' ? validateExercise(entry) : validateBreak(entry)
}

type RoutineErrorField =
  | 'entries'
  | 'quickRestDurationSec'
  | 'warningLeadTimeSec'
  | 'metronomeSound'
  | 'alternateBeatTone'
  | 'form'

export type RoutineValidation = FieldErrors<RoutineErrorField> & {
  valid: boolean
  entriesById: Record<string, EntryErrors>
}

export function validateRoutine(routine: Routine): RoutineValidation {
  const parsed = z.safeParse(routineSchema, routine)
  const entriesById = Object.fromEntries(
    routine.entries
      .map((entry) => [entry.id, validateEntry(entry)] as const)
      .filter(([, errors]) => Object.keys(errors).length > 0),
  )
  const errors: RoutineValidation = {
    valid: parsed.success,
    entriesById,
  }
  if (routine.entries.length === 0) errors.entries = 'Add at least one routine entry.'
  else if (routine.entries.length > ROUTINE_ENTRY_MAX_COUNT)
    errors.entries = `Use at most ${ROUTINE_ENTRY_MAX_COUNT.toLocaleString()} routine entries.`
  if (!z.safeParse(quickRestDurationSchema, routine.quickRestDurationSec).success)
    errors.quickRestDurationSec = 'Use a Quick Rest duration in the configured range.'
  if (!z.safeParse(warningLeadTimeSchema, routine.warningLeadTimeSec).success)
    errors.warningLeadTimeSec = 'Use a Warning lead time in the configured range.'
  if (!z.safeParse(metronomeSoundSchema, routine.metronomeSound).success)
    errors.metronomeSound = 'Choose a Metronome sound.'
  if (typeof routine.alternateBeatTone !== 'boolean')
    errors.alternateBeatTone = 'Choose whether even Beats use the alternate tone.'
  if (
    !parsed.success &&
    parsed.error.issues.some((issue) => !isActionableIssue(issue.path, issue.code))
  )
    errors.form = 'This Routine contains invalid data.'
  return errors
}

export function isRoutineValid(routine: Routine): boolean {
  return validateRoutine(routine).valid
}

function isActionableIssue(path: PropertyKey[], code: string): boolean {
  const [field, entryIndex, entryField] = path
  if (
    field === 'quickRestDurationSec' ||
    field === 'warningLeadTimeSec' ||
    field === 'metronomeSound' ||
    field === 'alternateBeatTone'
  )
    return true
  if (field !== 'entries') return false
  if (typeof entryIndex === 'number')
    return entryField === 'title' || entryField === 'tempoBpm' || entryField === 'durationSec'
  return code === 'too_small' || code === 'too_big'
}
