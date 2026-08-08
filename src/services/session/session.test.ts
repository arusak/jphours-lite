import { describe, expect, it, vi } from 'vitest'
import type { Routine, RoutineEntry } from '../../domain/routine'
import { buildSessionPlan, buildSessionSteps } from './buildSessionSteps'
import { SessionRunner, type Clock, type TimeoutScheduler } from './SessionRunner'

const routine = (entries: RoutineEntry[], quickRestDurationSec = 10): Routine => ({
  schemaVersion: 2,
  id: 'routine-1',
  name: 'Warmup',
  entries,
  quickRestDurationSec,
  metronomeSound: 'classic',
  warningLeadTimeSec: 20,
  autoAdvance: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const exercise = (id: string, tempoBpm: number | null, durationSec: number | null) => ({
  id,
  kind: 'exercise' as const,
  title: `Exercise ${id}`,
  tempoBpm,
  durationSec,
})
const breakEntry = (id: string, durationSec: number) => ({
  id,
  kind: 'break' as const,
  durationSec,
})

class FakeTime implements Clock, TimeoutScheduler {
  value = 0
  private nextId = 1
  private timers = new Map<number, { at: number; callback: () => void }>()
  now = (): number => this.value
  setTimeout(callback: () => void, delayMs: number): number {
    const id = this.nextId++
    this.timers.set(id, { at: this.value + delayMs, callback })
    return id
  }
  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number)
  }
  advance(milliseconds: number): void {
    const target = this.value + milliseconds
    while (true) {
      const next = [...this.timers.entries()].sort((a, b) => a[1].at - b[1].at)[0]
      if (!next || next[1].at > target) break
      this.value = next[1].at
      this.timers.delete(next[0])
      next[1].callback()
    }
    this.value = target
  }
}

describe('buildSessionSteps', () => {
  it('captures every ordered entry and models Quick Rest only between adjacent exercises', () => {
    const plan = buildSessionPlan(
      routine([
        exercise('paced', 120, 30),
        breakEntry('planned', 45),
        exercise('free', null, 30),
        exercise('paced-open', 90, null),
        exercise('open', null, null),
      ]),
    )
    expect(plan.steps.map((step) => (step.kind === 'exercise' ? step.mode : step.kind))).toEqual([
      'paced-timed',
      'break',
      'free-timed',
      'paced-open-ended',
      'open-ended',
    ])
    expect(plan.quickRests).toEqual([
      expect.objectContaining({ afterStepId: 'exercise:free', durationSec: 10 }),
      expect.objectContaining({ afterStepId: 'exercise:paced-open', durationSec: 10 }),
    ])
    expect(buildSessionSteps(routine([breakEntry('only', 30)], 0))).toHaveLength(1)
  })

  it('constructs a paced open-ended step without a duration', () => {
    expect(buildSessionSteps(routine([exercise('paced-open', 100, null)]))[0]).toMatchObject({
      mode: 'paced-open-ended',
      tempoBpm: 100,
      durationSec: null,
    })
  })

  it('captures consecutive Breaks as separate meaningful steps', () => {
    expect(
      buildSessionSteps(
        routine([breakEntry('first-break', 60), breakEntry('second-break', 120)], 0),
      ),
    ).toMatchObject([
      { id: 'break:first-break', kind: 'break', durationSec: 60 },
      { id: 'break:second-break', kind: 'break', durationSec: 120 },
    ])
  })
})

describe('SessionRunner', () => {
  it('starts at the first step, warns once, and ignores stale completion', () => {
    const time = new FakeTime()
    const warning = vi.fn()
    const runner = new SessionRunner(time, time, { onWarning: warning })
    runner.start(
      routine([exercise('one', null, 25), breakEntry('planned', 10), exercise('two', null, null)]),
    )
    expect(runner.getState().currentStepIndex).toBe(0)
    time.advance(5_000)
    expect(warning).toHaveBeenCalledTimes(1)
    runner.skipStep()
    expect(runner.getState().currentStepIndex).toBe(1)
    runner.dispatch({ type: 'STEP_COMPLETED', stepId: 'exercise:one', now: time.now() })
    expect(runner.getState().currentStepIndex).toBe(1)
  })

  it('applies the Routine warning lead to Breaks, suppression, and paced Beat alignment', () => {
    const time = new FakeTime()
    const warning = vi.fn()
    const runner = new SessionRunner(time, time, { onWarning: warning })
    runner.start({ ...routine([breakEntry('break', 30)], 0), warningLeadTimeSec: 20 })
    time.advance(9_999)
    expect(warning).not.toHaveBeenCalled()
    time.advance(1)
    expect(warning).toHaveBeenCalledWith(expect.objectContaining({ kind: 'break' }))

    runner.start({ ...routine([exercise('short', null, 20)], 0), warningLeadTimeSec: 20 })
    time.advance(20_000)
    expect(warning).toHaveBeenCalledTimes(1)

    runner.start({ ...routine([exercise('paced', 100, 31)], 0), warningLeadTimeSec: 20 })
    time.advance(10_799)
    expect(warning).toHaveBeenCalledTimes(1)
    time.advance(1)
    expect(warning).toHaveBeenCalledTimes(2)
  })

  it('does not auto-complete open-ended work and pauses/resumes a timed step', () => {
    const time = new FakeTime()
    const runner = new SessionRunner(time, time)
    runner.start(routine([exercise('open', null, null)]))
    runner.dispatch({ type: 'STEP_COMPLETED', stepId: 'exercise:open', now: time.now() })
    expect(runner.getState().status).toBe('running')

    runner.start(routine([exercise('timed', null, 10)]))
    time.advance(3_000)
    runner.pause()
    expect(runner.getState().pausedRemainingSec).toBe(7)
    time.advance(20_000)
    expect(runner.getState().status).toBe('paused')
    runner.resume()
    time.advance(7_000)
    expect(runner.getState().status).toBe('completed')
  })

  it('freezes and preserves open-ended elapsed time across pause and resume', () => {
    const time = new FakeTime()
    const runner = new SessionRunner(time, time)
    runner.start(routine([exercise('open', null, null)]))
    time.advance(4_000)
    runner.pause()
    expect(runner.getState().pausedElapsedSec).toBe(4)
    time.advance(10_000)
    expect(runner.getState().pausedElapsedSec).toBe(4)
    runner.resume()
    time.advance(2_000)
    expect((time.now() - runner.getState().currentStepStartedAt!) / 1000).toBe(6)
  })

  it('rewinds an explicit Break and resumes with a fresh full timer', () => {
    const time = new FakeTime()
    const stopped = vi.fn()
    const runner = new SessionRunner(time, time, { onStepStop: stopped })
    runner.start(
      routine([exercise('one', 120, 10), breakEntry('rest', 5), exercise('two', null, 10)], 0),
    )
    time.advance(10_000)
    expect(runner.getState().currentStepIndex).toBe(1)

    time.advance(2_000)
    runner.rewind()
    expect(runner.getState()).toMatchObject({ currentStepIndex: 1, currentStepEndsAt: 17_000 })
    expect(stopped).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'break' }), 'REWIND')

    time.advance(3_000)
    runner.pause()
    time.advance(20_000)
    runner.resume()
    time.advance(7_000)
    expect(runner.getState().currentStepIndex).toBe(2)
    time.advance(10_000)
    expect(runner.getState().status).toBe('completed')
  })

  it('cancels the stale Break timer when rewinding', () => {
    const time = new FakeTime()
    const runner = new SessionRunner(time, time)
    runner.start(
      routine([exercise('one', null, 1), breakEntry('rest', 10), exercise('two', null, 10)], 0),
    )
    time.advance(1_000)
    runner.rewindBreak()
    time.advance(1_000)
    expect(runner.getState().currentStepIndex).toBe(1)
    time.advance(8_000)
    expect(runner.getState().currentStepIndex).toBe(1)
  })

  it('runs Quick Rest as a transition, skips it, and rewinds to the preceding exercise', () => {
    const time = new FakeTime()
    const started = vi.fn()
    const runner = new SessionRunner(time, time, { onQuickRestStart: started })
    runner.start(routine([exercise('one', null, 2), exercise('two', null, 10)], 5))
    time.advance(2_000)
    expect(runner.getState()).toMatchObject({
      phase: 'quick-rest',
      currentStepIndex: 0,
      currentStepEndsAt: 7_000,
    })
    expect(started).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'quick-rest:one' }),
      expect.anything(),
    )
    runner.rewind()
    expect(runner.getState()).toMatchObject({
      phase: 'step',
      currentStepIndex: 0,
      currentStepEndsAt: 4_000,
    })
    time.advance(2_000)
    expect(runner.getState().phase).toBe('quick-rest')
    runner.skipStep()
    expect(runner.getState()).toMatchObject({ phase: 'step', currentStepIndex: 1 })
  })

  it('ignores a stale Quick Rest completion after it is skipped', () => {
    const time = new FakeTime()
    const runner = new SessionRunner(time, time)
    runner.start(routine([exercise('one', null, 1), exercise('two', null, 10)], 10))
    time.advance(1_000)
    runner.skipStep()
    runner.dispatch({ type: 'STEP_COMPLETED', stepId: 'quick-rest:one', now: time.now() })
    expect(runner.getState()).toMatchObject({ phase: 'step', currentStepIndex: 1 })
  })
})
