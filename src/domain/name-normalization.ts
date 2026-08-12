import {
  DEFAULT_EXERCISE_NAME,
  DEFAULT_ROUTINE_NAME,
  EXERCISE_NAME_MAX_LENGTH,
  ROUTINE_NAME_MAX_LENGTH,
} from './routine'

const invisibleFormatting = new RegExp(
  '[\\u061C\\u200B\\u200E\\u200F\\u2060\\uFEFF\\u202A-\\u202E\\u2066-\\u2069]',
  'gu',
)

function sanitizeNameInput(value: string, maxLength: number): string {
  const wellFormed = Array.from(value, (character) => {
    const codePoint = character.codePointAt(0)!
    const controlOrLineSeparator =
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      codePoint === 0x2028 ||
      codePoint === 0x2029
    const malformedSurrogate = character.length === 1 && codePoint >= 0xd800 && codePoint <= 0xdfff
    const noncharacter =
      (codePoint >= 0xfdd0 && codePoint <= 0xfdef) || (codePoint & 0xffff) >= 0xfffe
    if (controlOrLineSeparator) return ' '
    return malformedSurrogate || noncharacter ? '\uFFFD' : character
  }).join('')
  const normalized = wellFormed
    .normalize('NFC')
    .replace(invisibleFormatting, '')
    .replace(/\s+/gu, ' ')
  const truncated = normalized.slice(0, maxLength)
  return /[\uD800-\uDBFF]$/u.test(truncated) ? truncated.slice(0, -1) : truncated
}

export const sanitizeRoutineNameInput = (value: string): string =>
  sanitizeNameInput(value, ROUTINE_NAME_MAX_LENGTH)

export const sanitizeExerciseNameInput = (value: string): string =>
  sanitizeNameInput(value, EXERCISE_NAME_MAX_LENGTH)

export const normalizeRoutineName = (value: string): string =>
  sanitizeRoutineNameInput(value).trim() || DEFAULT_ROUTINE_NAME

export const normalizeExerciseName = (value: string): string =>
  sanitizeExerciseNameInput(value).trim() || DEFAULT_EXERCISE_NAME
