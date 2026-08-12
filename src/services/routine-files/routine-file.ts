import { v4 as uuidv4 } from 'uuid'
import * as z from 'zod/mini'
import {
  EXERCISE_NAME_MAX_LENGTH,
  ROUTINE_ENTRY_MAX_COUNT,
  ROUTINE_NAME_MAX_LENGTH,
  ROUTINE_SCHEMA_VERSION,
  type Routine,
} from '../../domain/routine'
import { normalizeExerciseName, normalizeRoutineName } from '../../domain/name-normalization'
import {
  breakDurationSchema,
  exerciseDurationSchema,
  metronomeSoundSchema,
  quickRestDurationSchema,
  tempoSchema,
  warningLeadTimeSchema,
} from '../../domain/routine-schema'

const ROUTINE_FILE_FORMAT = 'jphours-routine' as const
const ROUTINE_FILE_FORMAT_VERSION = 1 as const
export const ROUTINE_FILE_MAX_BYTES = 1_000_000

const normalizedNameSchema = (normalize: (value: string) => string, maxLength: number) =>
  z.string().check(z.overwrite(normalize), z.minLength(1), z.maxLength(maxLength))

const transferExerciseSchema = z.strictObject({
  kind: z.literal('exercise'),
  title: normalizedNameSchema(normalizeExerciseName, EXERCISE_NAME_MAX_LENGTH),
  tempoBpm: z.nullable(tempoSchema),
  durationSec: z.nullable(exerciseDurationSchema),
})

const transferBreakSchema = z.strictObject({
  kind: z.literal('break'),
  durationSec: breakDurationSchema,
})

const transferRoutineSchema = z.strictObject({
  name: normalizedNameSchema(normalizeRoutineName, ROUTINE_NAME_MAX_LENGTH),
  entries: z
    .array(z.discriminatedUnion('kind', [transferExerciseSchema, transferBreakSchema]))
    .check(z.minLength(1), z.maxLength(ROUTINE_ENTRY_MAX_COUNT)),
  quickRestDurationSec: quickRestDurationSchema,
  warningLeadTimeSec: warningLeadTimeSchema,
  metronomeSound: metronomeSoundSchema,
  alternateBeatTone: z.boolean(),
})

const routineFileSchema = z.strictObject({
  format: z.literal(ROUTINE_FILE_FORMAT),
  formatVersion: z.literal(ROUTINE_FILE_FORMAT_VERSION),
  exportedAt: z.iso.datetime({ precision: 3 }).check(z.length(24)),
  routine: transferRoutineSchema,
})

type TransferRoutine = z.infer<typeof transferRoutineSchema>
type RoutineFile = z.infer<typeof routineFileSchema>
type RoutineFileParseResult =
  | { success: true; routine: Routine }
  | { success: false; message: string }

export function serializeRoutineFile(routine: Routine, now = new Date()): string {
  const file: RoutineFile = {
    format: ROUTINE_FILE_FORMAT,
    formatVersion: ROUTINE_FILE_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    routine: toTransferRoutine(routine),
  }
  const parsed = z.safeParse(routineFileSchema, file)
  if (!parsed.success) throw new TypeError('Cannot export an invalid Routine.')
  return `${JSON.stringify(parsed.data, null, 2)}\n`
}

export function parseRoutineFileText(text: string): RoutineFileParseResult {
  if (new TextEncoder().encode(text).byteLength > ROUTINE_FILE_MAX_BYTES)
    return validationFailure('file_too_large')

  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return validationFailure('malformed_json')
  }

  const result = z.safeParse(routineFileSchema, value)
  if (!result.success) return invalidRoutineFile(value, result.error.issues)

  return { success: true, routine: toLocalRoutine(result.data.routine) }
}

export function routineFileName(name: string): string {
  const safeName = normalizeRoutineName(name)
    .replace(/\s+/gu, '_')
    .replace(/[^\p{L}\p{M}\p{N}_]/gu, '')
    .replace(/_+/gu, '_')
    .replace(/^_+|_+$/gu, '')
  return `JPHours_${safeName || 'Practice_Routine'}.json`
}

function toTransferRoutine(routine: Routine): TransferRoutine {
  return {
    name: normalizeRoutineName(routine.name),
    entries: routine.entries.map((entry) =>
      entry.kind === 'exercise'
        ? {
            kind: 'exercise',
            title: normalizeExerciseName(entry.title),
            tempoBpm: entry.tempoBpm,
            durationSec: entry.durationSec,
          }
        : { kind: 'break', durationSec: entry.durationSec },
    ),
    quickRestDurationSec: routine.quickRestDurationSec,
    warningLeadTimeSec: routine.warningLeadTimeSec,
    metronomeSound: routine.metronomeSound,
    alternateBeatTone: routine.alternateBeatTone,
  }
}

function toLocalRoutine(routine: TransferRoutine): Routine {
  return {
    schemaVersion: ROUTINE_SCHEMA_VERSION,
    id: uuidv4(),
    name: routine.name,
    entries: routine.entries.map((entry) => ({ ...entry, id: uuidv4() })),
    quickRestDurationSec: routine.quickRestDurationSec,
    warningLeadTimeSec: routine.warningLeadTimeSec,
    metronomeSound: routine.metronomeSound,
    alternateBeatTone: routine.alternateBeatTone,
    updatedAt: new Date().toISOString(),
  }
}

function invalidRoutineFile(
  value: unknown,
  validationIssues: ReadonlyArray<{ path: PropertyKey[]; code: string }>,
): RoutineFileParseResult {
  const formatVersion = readableFormatVersion(value)
  const issues = validationIssues.map((issue) => ({
    path: issue.path.join('.'),
    code: issue.code,
  }))
  console.warn('Routine import validation failed', { formatVersion, issues })
  return {
    success: false,
    message:
      formatVersion !== undefined && formatVersion !== ROUTINE_FILE_FORMAT_VERSION
        ? `This JP Hours Routine file uses unsupported format version ${String(formatVersion)}.`
        : 'This is not a supported JP Hours Routine file.',
  }
}

function validationFailure(code: string): RoutineFileParseResult {
  console.warn('Routine import validation failed', { issues: [{ path: '', code }] })
  return { success: false, message: 'This is not a supported JP Hours Routine file.' }
}

function readableFormatVersion(value: unknown): number | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const version = Object.hasOwn(value, 'formatVersion')
    ? (value as Record<string, unknown>).formatVersion
    : undefined
  return typeof version === 'number' && Number.isSafeInteger(version) ? version : undefined
}
