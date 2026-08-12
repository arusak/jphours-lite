import { describe, expect, it } from 'vitest'
import { createBreak, createExercise, createRoutine } from './routine'
import { isRoutineValid, validateExercise } from './validation'

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
})
