import { describe, expect, it, vi } from 'vitest'
import { AudioController } from '../AudioController'

type FakeContext = AudioContext & {
  now: number
  state: AudioContextState
  oscillators: FakeOscillator[]
  gains: FakeGain[]
  close: AudioContext['close'] & ReturnType<typeof vi.fn>
  resume: AudioContext['resume'] & ReturnType<typeof vi.fn>
  emitStateChange: () => void
}
type FakeOscillator = OscillatorNode & {
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}
type FakeGain = GainNode & {
  disconnect: GainNode['disconnect'] & ReturnType<typeof vi.fn>
  gain: AudioParam & {
    setValueAtTime: ReturnType<typeof vi.fn>
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>
  }
}

function makeContext(state: AudioContextState | 'interrupted' = 'running'): FakeContext {
  const oscillators: FakeOscillator[] = []
  const gains: FakeGain[] = []
  const stateListeners = new Set<() => void>()
  const context = {
    now: 0,
    state,
    destination: {},
    resume: vi.fn(async () => {
      context.state = 'running'
    }),
    close: vi.fn(async () => {
      context.state = 'closed'
    }),
    addEventListener: vi.fn((_type: string, listener: () => void) => stateListeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: () => void) =>
      stateListeners.delete(listener),
    ),
    createGain: vi.fn(() => {
      const gain = {
        gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      } as unknown as FakeGain
      gains.push(gain)
      return gain
    }),
    createOscillator: vi.fn(() => {
      const oscillator = {
        frequency: { value: 0 },
        type: 'sine',
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      } as unknown as FakeOscillator
      oscillators.push(oscillator)
      return oscillator
    }),
    get currentTime() {
      return context.now
    },
  } as unknown as FakeContext
  context.oscillators = oscillators
  context.gains = gains
  context.emitStateChange = () => stateListeners.forEach((listener) => listener())
  return context
}

describe('AudioController', () => {
  it('ensures a suspended audio context is running from the explicit start gesture', async () => {
    const context = makeContext('suspended')
    const controller = new AudioController({ contextFactory: () => context })

    await expect(controller.ensureRunning()).resolves.toBe(true)
    expect(context.resume).toHaveBeenCalledOnce()
  })

  it('recovers WebKit interrupted contexts with resume', async () => {
    const context = makeContext('interrupted')
    const controller = new AudioController({ contextFactory: () => context })

    await expect(controller.ensureRunning()).resolves.toBe(true)
    expect(context.resume).toHaveBeenCalledOnce()
  })

  it('schedules metronome beats against the audio clock without duplicate scheduling', () => {
    const context = makeContext()
    const intervals: Array<() => void> = []
    const onBeatScheduled = vi.fn()
    const controller = new AudioController({
      contextFactory: () => context,
      setIntervalFn: ((callback: () => void) => {
        intervals.push(callback)
        return 1
      }) as typeof setInterval,
      clearIntervalFn: vi.fn() as unknown as typeof clearInterval,
    })

    expect(controller.startMetronome({ bpm: 120, onBeatScheduled })).toBe(true)
    expect(onBeatScheduled).toHaveBeenCalledTimes(1)
    expect(onBeatScheduled).toHaveBeenLastCalledWith({
      beatIndex: 0,
      positionInPattern: 0,
      accent: 'primary',
      tempoBpm: 120,
      time: 0.05,
    })

    intervals[0]!()
    expect(onBeatScheduled).toHaveBeenCalledTimes(1)
    context.now = 0.45
    intervals[0]!()
    expect(onBeatScheduled).toHaveBeenLastCalledWith({
      beatIndex: 1,
      positionInPattern: 1,
      accent: 'secondary',
      tempoBpm: 120,
      time: 0.55,
    })
    expect(onBeatScheduled).toHaveBeenCalledTimes(2)
  })

  it('cancels scheduled sources and its polling timer when paused', () => {
    const context = makeContext()
    const clearIntervalFn = vi.fn()
    const controller = new AudioController({
      contextFactory: () => context,
      setIntervalFn: vi.fn(() => 7) as unknown as typeof setInterval,
      clearIntervalFn: clearIntervalFn as unknown as typeof clearInterval,
    })
    controller.startMetronome({ bpm: 120 })

    controller.pauseMetronome()
    expect(clearIntervalFn).toHaveBeenCalledWith(7)
    expect(context.oscillators[0]?.stop).toHaveBeenCalled()
  })

  it('keeps an already queued Beat in place and applies live Tempo after it', () => {
    const context = makeContext()
    const intervals: Array<() => void> = []
    const clearIntervalFn = vi.fn()
    const onBeatScheduled = vi.fn()
    const controller = new AudioController({
      contextFactory: () => context,
      scheduleAheadSec: 1,
      setIntervalFn: ((callback: () => void) => {
        intervals.push(callback)
        return intervals.length
      }) as typeof setInterval,
      clearIntervalFn: clearIntervalFn as unknown as typeof clearInterval,
    })
    controller.startMetronome({ bpm: 120, onBeatScheduled })
    expect(onBeatScheduled).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ beatIndex: 1, time: 0.55, tempoBpm: 120 }),
    )

    context.now = 0.2
    expect(controller.updateMetronomeTempo(60)).toBe(true)
    expect(clearIntervalFn).not.toHaveBeenCalled()

    context.now = 0.96
    intervals[0]!()
    expect(onBeatScheduled).toHaveBeenLastCalledWith(
      expect.objectContaining({ beatIndex: 2, time: 1.55, tempoBpm: 60 }),
    )
  })

  it('restarts audible Beat snapshots when a paused Metronome resumes', () => {
    vi.useFakeTimers()
    const context = makeContext()
    const controller = new AudioController({ contextFactory: () => context })

    controller.startMetronome({ bpm: 120 })
    vi.advanceTimersByTime(50)
    expect(controller.getBeatSnapshot()).toMatchObject({ beatIndex: 0, running: true })

    controller.pauseMetronome()
    expect(controller.getBeatSnapshot()).toMatchObject({ running: false })

    expect(controller.resumeMetronome()).toBe(true)
    vi.advanceTimersByTime(50)
    expect(controller.getBeatSnapshot()).toMatchObject({ beatIndex: 1, running: true })
  })

  it('uses a changed Metronome sound only for Beats scheduled afterwards', () => {
    const context = makeContext()
    const intervals: Array<() => void> = []
    const controller = new AudioController({
      contextFactory: () => context,
      setIntervalFn: ((callback: () => void) => {
        intervals.push(callback)
        return intervals.length
      }) as typeof setInterval,
    })

    controller.startMetronome({ bpm: 120, sound: 'classic' })
    const alreadyScheduled = context.oscillators[0]!
    expect(controller.updateMetronomeSound('wood')).toBe(true)
    expect(alreadyScheduled.frequency.value).toBe(1100)

    context.now = 0.45
    intervals[0]!()
    expect(context.oscillators[1]!.frequency.value).toBeCloseTo(720 * 2 ** (-3 / 12))
    expect(context.oscillators[1]!.type).toBe('triangle')
  })

  it('uses alternate tone on secondary Beats while preserving waveform and decay', () => {
    const context = makeContext()
    const intervals: Array<() => void> = []
    const controller = new AudioController({
      contextFactory: () => context,
      setIntervalFn: ((callback: () => void) => {
        intervals.push(callback)
        return intervals.length
      }) as typeof setInterval,
    })
    controller.startMetronome({ bpm: 120, sound: 'classic' })
    const classic = context.oscillators[0]!
    expect(classic.frequency.value).toBe(1100)
    expect(classic.type).toBe('sine')
    const beatEnvelope = context.gains.at(-1)!
    expect(beatEnvelope.gain.exponentialRampToValueAtTime.mock.calls[0]?.[0]).toBe(0.35)

    context.now = 0.45
    intervals[0]!()
    const alternate = context.oscillators.at(-1)!
    expect(alternate.frequency.value).toBeCloseTo(1100 * 2 ** (-3 / 12))
    expect(alternate.type).toBe('sine')
    expect(context.gains.at(-1)!.gain.exponentialRampToValueAtTime.mock.calls[1]?.[1]).toBeCloseTo(
      0.55 + 0.06,
    )

    expect(controller.updateAlternateBeatTone(false)).toBe(true)
    context.now = 0.95
    intervals[0]!()
    expect(context.oscillators.at(-1)!.frequency.value).toBe(1100)
  })

  it('notifies visual consumers only at an audible Beat boundary', () => {
    vi.useFakeTimers()
    const context = makeContext()
    const controller = new AudioController({ contextFactory: () => context })
    const observed = vi.fn()
    controller.subscribeToBeats(observed)

    controller.startMetronome({ bpm: 120 })
    expect(controller.getBeatSnapshot().beatIndex).toBe(-1)
    vi.advanceTimersByTime(49)
    expect(controller.getBeatSnapshot().beatIndex).toBe(-1)
    vi.advanceTimersByTime(1)
    expect(controller.getBeatSnapshot()).toEqual(
      expect.objectContaining({ beatIndex: 0, positionInPattern: 0, running: true }),
    )
    expect(observed).toHaveBeenCalledTimes(3)
    vi.useRealTimers()
  })

  it('aligns a paced Warning cue with the tempo-adjusted Beat grid', () => {
    const context = makeContext()
    const intervals: Array<() => void> = []
    const controller = new AudioController({
      contextFactory: () => context,
      setIntervalFn: ((callback: () => void) => {
        intervals.push(callback)
        return intervals.length
      }) as typeof setInterval,
    })
    controller.startMetronome({ bpm: 120 })
    expect(controller.scheduleWarningAt(600)).toBe(true)

    context.now = 0.2
    controller.updateMetronomeTempo(60)
    context.now = 0.45
    intervals[0]!()

    expect(context.oscillators.map((oscillator) => oscillator.frequency.value)).toContain(660)
    expect(context.oscillators.at(-2)!.start).toHaveBeenCalledWith(0.55)
  })

  it('rejects an invalid live tempo without disturbing the active metronome', () => {
    const context = makeContext()
    const clearIntervalFn = vi.fn()
    const controller = new AudioController({
      contextFactory: () => context,
      setIntervalFn: vi.fn(() => 1) as unknown as typeof setInterval,
      clearIntervalFn: clearIntervalFn as unknown as typeof clearInterval,
    })
    controller.startMetronome({ bpm: 120 })
    expect(controller.updateMetronomeTempo(19)).toBe(false)
    expect(clearIntervalFn).not.toHaveBeenCalled()
  })

  it('keeps cue playback separate and gives each cue its own pitch pattern', () => {
    const context = makeContext()
    const controller = new AudioController({ contextFactory: () => context })

    expect(controller.playCue('session-complete')).toBe(true)
    expect(context.oscillators).toHaveLength(3)
    expect(context.oscillators.map((oscillator) => oscillator.frequency.value)).toEqual([
      660, 880, 1040,
    ])
  })

  it('does not throw when Web Audio is unavailable or BPM is outside the supported range', () => {
    const controller = new AudioController({ contextFactory: () => undefined })
    expect(controller.startMetronome({ bpm: 120 })).toBe(false)
    expect(controller.playCue('warning')).toBe(false)

    const supported = new AudioController({ contextFactory: () => makeContext() })
    expect(supported.startMetronome({ bpm: 19 })).toBe(false)
  })

  it('publishes lifecycle readiness and shares concurrent activation work', async () => {
    const context = makeContext('suspended')
    const controller = new AudioController({ contextFactory: () => context })
    const observed: string[] = []
    controller.subscribeToState(() => observed.push(controller.getStateSnapshot().status))

    const first = controller.ensureRunning()
    const second = controller.ensureRunning()
    expect(first).toBe(second)
    await expect(first).resolves.toBe(true)
    expect(context.resume).toHaveBeenCalledOnce()
    expect(controller.getStateSnapshot()).toMatchObject({ status: 'running', generation: 1 })
    expect(observed).toEqual(['activating', 'running'])
  })

  it('recovers a rejected resume with one fresh context', async () => {
    const rejected = makeContext('suspended')
    rejected.resume.mockRejectedValueOnce(new Error('blocked'))
    const replacement = makeContext('running')
    const factory = vi.fn(() => (factory.mock.calls.length === 1 ? rejected : replacement))
    const controller = new AudioController({ contextFactory: factory })

    await expect(controller.ensureRunning()).resolves.toBe(true)
    expect(factory).toHaveBeenCalledTimes(2)
    expect(rejected.close).toHaveBeenCalledOnce()
    expect(controller.getStateSnapshot()).toMatchObject({ status: 'running', generation: 3 })
  })

  it('bounds a never-settling resume and publishes unavailable after one replacement', async () => {
    vi.useFakeTimers()
    const stuck = makeContext('suspended')
    stuck.resume.mockImplementationOnce(() => new Promise<void>(() => undefined))
    const replacement = makeContext('suspended')
    replacement.resume.mockImplementationOnce(() => new Promise<void>(() => undefined))
    const factory = vi.fn(() => (factory.mock.calls.length === 1 ? stuck : replacement))
    const controller = new AudioController({ contextFactory: factory, activationTimeoutMs: 20 })

    const activation = controller.ensureRunning()
    await vi.advanceTimersByTimeAsync(40)
    await expect(activation).resolves.toBe(false)
    expect(factory).toHaveBeenCalledTimes(2)
    expect(stuck.close).toHaveBeenCalledOnce()
    expect(replacement.close).toHaveBeenCalledOnce()
    expect(controller.getStateSnapshot().status).toBe('unavailable')
    vi.useRealTimers()
  })

  it('ignores late resume and statechange events from a retired context', async () => {
    vi.useFakeTimers()
    let resolveResume!: () => void
    const stuck = makeContext('suspended')
    stuck.resume.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveResume = resolve
        }),
    )
    const replacement = makeContext('running')
    const factory = vi.fn(() => (factory.mock.calls.length === 1 ? stuck : replacement))
    const controller = new AudioController({ contextFactory: factory, activationTimeoutMs: 10 })

    const activation = controller.ensureRunning()
    await vi.advanceTimersByTimeAsync(10)
    await expect(activation).resolves.toBe(true)
    const snapshot = controller.getStateSnapshot()
    stuck.state = 'running'
    resolveResume()
    stuck.emitStateChange()
    await Promise.resolve()
    expect(controller.getStateSnapshot()).toEqual(snapshot)
    vi.useRealTimers()
  })

  it('stops the Metronome when the current context is interrupted and can recover it', async () => {
    const context = makeContext('running')
    const controller = new AudioController({ contextFactory: () => context })

    await controller.ensureRunning()
    controller.startMetronome({ bpm: 120 })
    context.state = 'interrupted'
    context.emitStateChange()

    expect(controller.getStateSnapshot().status).toBe('unavailable')
    expect(controller.getBeatSnapshot().running).toBe(false)
    expect(context.oscillators[0]?.stop).toHaveBeenCalled()

    await expect(controller.ensureRunning()).resolves.toBe(true)
    expect(context.resume).toHaveBeenCalledOnce()
  })

  it('refuses scheduling on a non-running context and disposes all owned resources once', async () => {
    const context = makeContext('suspended')
    const controller = new AudioController({ contextFactory: () => context })
    expect(controller.startMetronome({ bpm: 120 })).toBe(false)
    expect(controller.playCue('warning')).toBe(false)

    await controller.ensureRunning()
    controller.startMetronome({ bpm: 120 })
    controller.playCue('warning')
    controller.dispose()
    controller.dispose()

    expect(context.close).toHaveBeenCalledOnce()
    expect(context.oscillators.every((oscillator) => oscillator.stop.mock.calls.length > 0)).toBe(
      true,
    )
    expect(context.gains.every((gain) => gain.disconnect.mock.calls.length > 0)).toBe(true)
    expect(context.removeEventListener).toHaveBeenCalledOnce()
  })

  it('creates a fresh context after disposal', async () => {
    const first = makeContext('running')
    const second = makeContext('running')
    const factory = vi.fn(() => (factory.mock.calls.length === 1 ? first : second))
    const controller = new AudioController({ contextFactory: factory })

    await controller.ensureRunning()
    controller.dispose()
    await controller.ensureRunning()
    expect(factory).toHaveBeenCalledTimes(2)
    expect(first.close).toHaveBeenCalledOnce()
    expect(second.close).not.toHaveBeenCalled()
  })

  it('contains a close rejection during teardown', async () => {
    const context = makeContext('running')
    context.close.mockRejectedValueOnce(new Error('already closed'))
    const controller = new AudioController({ contextFactory: () => context })

    await controller.ensureRunning()
    expect(() => controller.dispose()).not.toThrow()
    await Promise.resolve()
    expect(context.close).toHaveBeenCalledOnce()
  })
})
