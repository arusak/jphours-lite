import { describe, expect, it } from 'vitest'
import * as z from 'zod/mini'
import { createBreak, createExercise, createRoutine } from './routine'
import {
  normalizeExerciseName,
  normalizeRoutineName,
  sanitizeExerciseNameInput,
  sanitizeRoutineNameInput,
} from './name-normalization'
import { routineSchema } from './routine-schema'
import { isRoutineValid, validateExercise, validateRoutine } from './validation'

describe('routine validation', () => {
  it('allows a tempo without a duration', () => {
    expect(validateExercise(createExercise({ title: 'Scales', tempoBpm: 100 }))).toEqual({})
  })

  it('accepts an open-ended exercise and a zero-second Quick Rest', () => {
    expect(
      isRoutineValid(
        createRoutine({
          entries: [createExercise({ title: 'Explore' })],
          quickRestDurationSec: 0,
        }),
      ),
    ).toBe(true)
  })

  it('accepts a Break-only Routine and rejects fractional-minute durations', () => {
    expect(isRoutineValid(createRoutine({ entries: [createBreak({ durationSec: 120 })] }))).toBe(
      true,
    )
    expect(validateExercise(createExercise({ durationSec: 90 })).durationSec).toBeDefined()
  })

  it.each([
    [59, 59],
    [60, 60],
    [61, 60],
  ])('normalizes a %i-code-unit name to %i code units', (inputLength, outputLength) => {
    expect(normalizeExerciseName('a'.repeat(inputLength))).toHaveLength(outputLength)
  })

  it('rejects duplicate local entry IDs', () => {
    const entry = createExercise()
    expect(
      z.safeParse(routineSchema, createRoutine({ entries: [entry, { ...entry }] })).success,
    ).toBe(false)
  })

  it('preserves legitimate RTL and emoji while neutralizing malformed Unicode', () => {
    expect(normalizeExerciseName('שלום 👩‍🎤')).toBe('שלום 👩‍🎤')
    expect(normalizeExerciseName(`a\uD800b\uFDD0c`)).toBe('a�b�c')
    expect(normalizeExerciseName(`${'a'.repeat(59)}😀`)).toBe('a'.repeat(59))
  })

  it('uses explicit defaults and limits for Routine and Exercise names', () => {
    expect(normalizeRoutineName('   ')).toBe('Practice routine')
    expect(normalizeExerciseName('   ')).toBe('Exercise')
    expect(sanitizeRoutineNameInput(' r\noutine ')).toBe(' r outine ')
    expect(sanitizeExerciseNameInput(' e\txercise ')).toBe(' e xercise ')
  })

  it('returns one authoritative result for actionable and schema-level errors', () => {
    const invalidIdentity = createRoutine({ id: 'not-a-uuid' })
    const result = validateRoutine(invalidIdentity)

    expect(result).toMatchObject({
      valid: false,
      form: 'This Routine contains invalid data.',
      entriesById: {},
    })
    expect(isRoutineValid(invalidIdentity)).toBe(result.valid)
  })

  it('does not report a whitespace-only Exercise name as valid', () => {
    const result = validateRoutine(createRoutine({ entries: [createExercise({ title: '   ' })] }))

    expect(result.valid).toBe(false)
    expect(Object.values(result.entriesById)[0]).toMatchObject({
      title: 'Enter an exercise name.',
    })
  })

  it('reports the same padded Exercise-name limit enforced by the schema', () => {
    const result = validateRoutine(
      createRoutine({ entries: [createExercise({ title: ` ${'a'.repeat(59)} ` })] }),
    )

    expect(result.valid).toBe(false)
    expect(Object.values(result.entriesById)[0]).toMatchObject({
      title: 'Use at most 60 characters.',
    })
  })

  it('reports prototype property names as invalid Metronome sounds', () => {
    const result = validateRoutine(createRoutine({ metronomeSound: 'constructor' as never }))

    expect(result).toMatchObject({
      valid: false,
      metronomeSound: 'Choose a Metronome sound.',
    })
  })
})
