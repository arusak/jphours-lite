import { describe, expect, it, vi } from 'vitest'
import * as z from 'zod/mini'
import { createExercise } from '../../../domain/routine'
import { exerciseSchema, routineSchema } from '../../../domain/routine-schema'
import {
  RANDOM_ROUTINE_ADJECTIVES,
  RANDOM_ROUTINE_EXERCISE_NAMES,
  RANDOM_ROUTINE_NOUNS,
  createBlankRoutine,
  createRandomRoutine,
} from '../routine-creation'

describe('routine creation', () => {
  it('creates the minimal Practice Exercise with its feature defaults', () => {
    const routine = createBlankRoutine('New routine 2')

    expect(routine.name).toBe('New routine 2')
    expect(routine.entries).toMatchObject([
      { kind: 'exercise', title: 'Practice', durationSec: 300, tempoBpm: 100 },
    ])
    expect(z.safeParse(routineSchema, routine).success).toBe(true)
  })

  it('defines 30 unique, short title-cased name words and 30 valid Exercise names', () => {
    for (const pool of [RANDOM_ROUTINE_ADJECTIVES, RANDOM_ROUTINE_NOUNS]) {
      expect(pool).toHaveLength(30)
      expect(new Set(pool).size).toBe(30)
      expect(pool.every((word) => /^[A-Z][a-z]+$/u.test(word) && word.length <= 8)).toBe(true)
    }

    expect(RANDOM_ROUTINE_EXERCISE_NAMES).toHaveLength(30)
    expect(new Set(RANDOM_ROUTINE_EXERCISE_NAMES).size).toBe(30)
    expect(
      RANDOM_ROUTINE_EXERCISE_NAMES.every(
        (name) => z.safeParse(exerciseSchema, createExercise({ title: name })).success,
      ),
    ).toBe(true)
  })

  it.each([
    [[0, 0], 'Bitter Beat'],
    [[0.999_999, 0.999_999], 'Wry Cowbell'],
    [[0, 0.999_999], 'Bitter Cowbell'],
  ])('selects independent Routine-name words at the pool boundaries', (randomness, name) => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(randomness[0]!)
      .mockReturnValueOnce(randomness[1]!)
      .mockReturnValue(0)

    const routine = createRandomRoutine()

    expect(routine.name).toBe(name)
    expect(routine.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/u)
    expect(routine.name.length).toBeLessThanOrEqual(60)
    vi.restoreAllMocks()
  })

  it('creates a valid editable twenty-minute Routine with five distinct Exercises', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const routine = createRandomRoutine()
    const exercises = routine.entries.filter((entry) => entry.kind === 'exercise')

    expect(exercises).toHaveLength(5)
    expect(new Set(exercises.map((exercise) => exercise.title)).size).toBe(5)
    expect(
      exercises.map((exercise) => exercise.durationSec).sort((left, right) => left! - right!),
    ).toEqual([180, 180, 240, 300, 300])
    expect(exercises.reduce((total, exercise) => total + exercise.durationSec!, 0)).toBe(1_200)
    expect(
      exercises.map((exercise) => exercise.tempoBpm).sort((left, right) => left! - right!),
    ).toEqual([80, 90, 100, 110, 120])
    expect(routine.quickRestDurationSec).toBe(5)
    expect(routine.entries.every((entry) => entry.kind === 'exercise')).toBe(true)
    expect(z.safeParse(routineSchema, routine).success).toBe(true)
    vi.restoreAllMocks()
  })

  it.each([
    ['ascending', [0.999, 0.999, 0.999, 0.999]],
    ['descending', [0, 0.25, 0.999, 0.999]],
  ])('corrects a %s Tempo shuffle into a mixed order', (_branch, tempoRandomness) => {
    const randomValues = [0, 0, ...Array.from({ length: 29 + 4 }, () => 0), ...tempoRandomness]
    vi.spyOn(Math, 'random').mockImplementation(() => randomValues.shift() ?? 0)

    const tempos = createRandomRoutine()
      .entries.filter((entry) => entry.kind === 'exercise')
      .map((entry) => entry.tempoBpm!)

    expect(tempos).not.toEqual([80, 90, 100, 110, 120])
    expect(tempos).not.toEqual([120, 110, 100, 90, 80])
    vi.restoreAllMocks()
  })

  it('keeps its source pools intact and gives every Routine and Exercise fresh identities', () => {
    const sourcePools = [
      [...RANDOM_ROUTINE_ADJECTIVES],
      [...RANDOM_ROUTINE_NOUNS],
      [...RANDOM_ROUTINE_EXERCISE_NAMES],
    ]
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const first = createRandomRoutine()
    const second = createRandomRoutine()

    expect([
      RANDOM_ROUTINE_ADJECTIVES,
      RANDOM_ROUTINE_NOUNS,
      RANDOM_ROUTINE_EXERCISE_NAMES,
    ]).toEqual(sourcePools)
    expect(second.name).toBe(first.name)
    expect(second.id).not.toBe(first.id)
    expect(new Set(first.entries.map((entry) => entry.id)).size).toBe(5)
    expect(new Set(second.entries.map((entry) => entry.id)).size).toBe(5)
    expect(new Set([...first.entries, ...second.entries].map((entry) => entry.id)).size).toBe(10)
    vi.restoreAllMocks()
  })
})
