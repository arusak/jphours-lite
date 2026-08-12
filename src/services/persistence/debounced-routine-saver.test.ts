import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRoutine } from '../../domain/routine'
import { DebouncedRoutineSaver } from './debounced-routine-saver'

afterEach(() => vi.useRealTimers())

describe('DebouncedRoutineSaver', () => {
  it('cancels a pending save so it cannot overwrite a replacement', () => {
    vi.useFakeTimers()
    const save = vi.fn()
    const saver = new DebouncedRoutineSaver({ load: createRoutine, save }, 300)

    saver.schedule(createRoutine({ name: 'Stale edit' }))
    saver.cancel()
    vi.advanceTimersByTime(300)

    expect(save).not.toHaveBeenCalled()
  })
})
