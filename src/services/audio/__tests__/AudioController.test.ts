import { describe, expect, it, vi } from 'vitest'
import { AudioController } from '../AudioController'

type FakeContext = AudioContext & {
  now: number
  state: AudioContextState
  oscillators: FakeOscillator[]
  gains: FakeGain[]
}
type FakeOscillator = OscillatorNode & {
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}
type FakeGain = GainNode & {
  gain: AudioParam & {
    setValueAtTime: ReturnType<typeof vi.fn>
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>
  }
}

function makeContext(state: AudioContextState = 'running'): FakeContext {
  const oscillators: FakeOscillator[] = []
  const gains: FakeGain[] = []
  const context = {
    now: 0,
    state,
    destination: {},
    resume: vi.fn(async () => {
      context.state = 'running'
    }),
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
  return context
}

describe('AudioController', () => {
  it('unlocks a suspended audio context from the explicit start gesture', async () => {
    const context = makeContext('suspended')
    const controller = new AudioController({ contextFactory: () => context })

    await expect(controller.unlock()).resolves.toBe(true)
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

  it('keeps the pending Beat in place and applies live Tempo after it', () => {
    const context = makeContext()
    const intervals: Array<() => void> = []
    const clearIntervalFn = vi.fn()
    const onBeatScheduled = vi.fn()
    const controller = new AudioController({
      contextFactory: () => context,
      setIntervalFn: ((callback: () => void) => {
        intervals.push(callback)
        return intervals.length
      }) as typeof setInterval,
      clearIntervalFn: clearIntervalFn as unknown as typeof clearInterval,
    })
    controller.startMetronome({ bpm: 120, onBeatScheduled })
    const oldSource = context.oscillators[0]!
    const scheduledStopCalls = oldSource.stop.mock.calls.length

    context.now = 0.2
    expect(controller.updateMetronomeTempo(60)).toBe(true)
    expect(clearIntervalFn).not.toHaveBeenCalled()
    expect(oldSource.stop).toHaveBeenCalledTimes(scheduledStopCalls)

    context.now = 0.45
    intervals[0]!()
    expect(onBeatScheduled).toHaveBeenLastCalledWith(
      expect.objectContaining({ beatIndex: 1, time: 0.55, tempoBpm: 60 }),
    )

    context.now = 1.46
    intervals[0]!()
    expect(onBeatScheduled).toHaveBeenLastCalledWith(
      expect.objectContaining({ beatIndex: 2, time: 1.55, tempoBpm: 60 }),
    )
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
})
