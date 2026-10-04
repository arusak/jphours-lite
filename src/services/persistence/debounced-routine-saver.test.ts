import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRoutine } from '../../domain/routine'
import { DebouncedRoutineSaver } from './debounced-routine-saver'

afterEach(() => vi.useRealTimers())

describe('DebouncedRoutineSaver', () => {
  it('cancels a pending save so it cannot overwrite a replacement', () => {
    vi.useFakeTimers()
    const save = vi.fn()
    const saver = new DebouncedRoutineSaver({ save }, 300)

    saver.schedule(createRoutine({ name: 'Stale edit' }))
    saver.cancel()
    vi.advanceTimersByTime(300)

    expect(save).not.toHaveBeenCalled()
  })
})

it('reports a background failure and retains the pending Routine for a successful retry', () => {
  vi.useFakeTimers()
  const routine = createRoutine({ name: 'Retry me' })
  const error = new Error('Storage full')
  const save = vi.fn().mockImplementationOnce(() => {
    throw error
  })
  const onError = vi.fn()
  const saver = new DebouncedRoutineSaver({ save }, 300, onError)
  saver.schedule(routine)
  expect(() => vi.advanceTimersByTime(300)).not.toThrow()
  expect(onError).toHaveBeenCalledWith(error)
  saver.flush()
  expect(save).toHaveBeenLastCalledWith(routine)
  expect(save).toHaveBeenCalledTimes(2)
  saver.flush()
  expect(save).toHaveBeenCalledTimes(2)
})

it('throws a synchronous flush failure and permits cancellation after a successful transition', () => {
  vi.useFakeTimers()
  const routine = createRoutine()
  const save = vi.fn().mockImplementationOnce(() => {
    throw new Error('Storage full')
  })
  const saver = new DebouncedRoutineSaver({ save })
  saver.schedule(routine)
  expect(() => saver.flush()).toThrow('Storage full')
  saver.flush()
  saver.schedule(createRoutine({ name: 'Stale Routine' }))
  saver.cancel()
  vi.advanceTimersByTime(300)
  expect(save).toHaveBeenCalledTimes(2)
  expect(save).toHaveBeenLastCalledWith(routine)
})
