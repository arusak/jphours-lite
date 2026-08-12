import * as z from 'zod/mini'
import { practiceConfig } from '../config/practice-config'
import {
  EXERCISE_NAME_MAX_LENGTH,
  ROUTINE_ENTRY_MAX_COUNT,
  ROUTINE_NAME_MAX_LENGTH,
  ROUTINE_SCHEMA_VERSION,
} from './routine'

export const routineNameSchema = z.string().check(
  z.minLength(1),
  z.maxLength(ROUTINE_NAME_MAX_LENGTH),
  z.refine((value) => value.trim().length > 0),
)
export const exerciseNameSchema = z.string().check(
  z.minLength(1),
  z.maxLength(EXERCISE_NAME_MAX_LENGTH),
  z.refine((value) => value.trim().length > 0),
)
export const idSchema = z.uuid()
const policyNumber = (policy: { min: number; max: number; increment: number }) =>
  z
    .number()
    .check(
      z.refine(
        (value) =>
          Number.isInteger(value) &&
          value >= policy.min &&
          value <= policy.max &&
          (value - policy.min) % policy.increment === 0,
      ),
    )

export const tempoSchema = policyNumber(practiceConfig.tempo)
export const exerciseDurationSchema = policyNumber(practiceConfig.exerciseDuration)
export const breakDurationSchema = policyNumber(practiceConfig.breakDuration)
export const quickRestDurationSchema = policyNumber(practiceConfig.quickRestDuration)
export const warningLeadTimeSchema = policyNumber(practiceConfig.warningLeadTime)
export const metronomeSoundSchema = z.union([
  z.literal('classic'),
  z.literal('wood'),
  z.literal('digital'),
])

export const exerciseSchema = z.strictObject({
  id: idSchema,
  kind: z.literal('exercise'),
  title: exerciseNameSchema,
  tempoBpm: z.nullable(tempoSchema),
  durationSec: z.nullable(exerciseDurationSchema),
})

export const breakSchema = z.strictObject({
  id: idSchema,
  kind: z.literal('break'),
  durationSec: breakDurationSchema,
})

export const routineEntrySchema = z.discriminatedUnion('kind', [exerciseSchema, breakSchema])

export const routineSchema = z.strictObject({
  schemaVersion: z.literal(ROUTINE_SCHEMA_VERSION),
  id: idSchema,
  name: routineNameSchema,
  entries: z.array(routineEntrySchema).check(
    z.minLength(1),
    z.maxLength(ROUTINE_ENTRY_MAX_COUNT),
    z.refine((entries) => new Set(entries.map((entry) => entry.id)).size === entries.length),
  ),
  quickRestDurationSec: quickRestDurationSchema,
  warningLeadTimeSec: warningLeadTimeSchema,
  metronomeSound: metronomeSoundSchema,
  alternateBeatTone: z.boolean(),
  updatedAt: z.iso.datetime({ precision: 3 }).check(z.length(24)),
})
