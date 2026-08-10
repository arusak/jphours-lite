import { practiceConfig, type MetronomeSound } from '../../config/practice-config'
import { BeatClock, type BeatAccent, type BeatSnapshot } from './BeatClock'
import type { AudioControllerOptions, AudioCue, MetronomeOptions } from './types'

const DEFAULT_POLL_MS = 25
const DEFAULT_SCHEDULE_AHEAD_SEC = 0.1
const START_DELAY_SEC = 0.05

const cuePatterns: Record<AudioCue, readonly number[]> = {
  warning: [660, 660],
  'exercise-complete': [660, 880],
  'break-complete': [880, 660, 880],
  'session-complete': [660, 880, 1040],
}

/**
 * Owns the single Web Audio context used by a session. Beats are scheduled against
 * the audio clock; the browser timer merely fills a small look-ahead window.
 */
export class AudioController {
  private readonly contextFactory: () => AudioContext | undefined
  private readonly setIntervalFn: typeof setInterval
  private readonly clearIntervalFn: typeof clearInterval
  private readonly schedulerPollMs: number
  private readonly scheduleAheadSec: number
  private context?: AudioContext
  private metronomeGain?: GainNode
  private cueGain?: GainNode
  private scheduler?: ReturnType<typeof setInterval>
  private nextBeatTime = 0
  private lastScheduledBeatTime: number | null = null
  private beatIndex = 0
  private metronome?: MetronomeOptions
  private readonly activeSources = new Set<OscillatorNode>()
  private readonly beatClock = new BeatClock()
  private warningTargetTime: number | null = null
  private warningScheduled = false
  private warningAnchoredToScheduledBeat = false
  private readonly warningSources = new Set<OscillatorNode>()

  public constructor(options: AudioControllerOptions = {}) {
    this.contextFactory = options.contextFactory ?? defaultContextFactory
    this.setIntervalFn = options.setIntervalFn ?? window.setInterval.bind(window)
    this.clearIntervalFn = options.clearIntervalFn ?? window.clearInterval.bind(window)
    this.schedulerPollMs = options.schedulerPollMs ?? DEFAULT_POLL_MS
    this.scheduleAheadSec = options.scheduleAheadSec ?? DEFAULT_SCHEDULE_AHEAD_SEC
  }

  /** Must be called from a user gesture (for example, Start session). */
  public async unlock(): Promise<boolean> {
    const context = this.getContext()
    if (!context) return false

    try {
      if (context.state === 'suspended') await context.resume()
      return context.state === 'running'
    } catch {
      return false
    }
  }

  public startMetronome(options: MetronomeOptions): boolean {
    if (!isValidBpm(options.bpm) || !this.getContext()) return false

    this.stopMetronome()
    this.metronome = {
      ...options,
      sound: options.sound ?? practiceConfig.metronome.defaultSound,
      alternateBeatTone: options.alternateBeatTone ?? true,
    }
    this.beatIndex = 0
    this.lastScheduledBeatTime = null
    this.beatClock.start(options.bpm)
    this.nextBeatTime = this.context!.currentTime + START_DELAY_SEC
    this.scheduleBeats()
    const fn = () => this.scheduleBeats()
    this.scheduler = this.setIntervalFn(fn, this.schedulerPollMs)
    return true
  }

  /** Applies Tempo after the next already-planned boundary without restarting the grid. */
  public updateMetronomeTempo(bpm: number): boolean {
    if (!isValidBpm(bpm) || !this.metronome || !this.getContext()) return false
    if (this.warningScheduled && !this.warningAnchoredToScheduledBeat) this.cancelScheduledWarning()
    this.metronome = { ...this.metronome, bpm }
    if (
      this.lastScheduledBeatTime !== null &&
      this.lastScheduledBeatTime > this.context!.currentTime
    )
      this.nextBeatTime = this.lastScheduledBeatTime + 60 / bpm
    return true
  }

  /** Applies a session-only sound preset to Beats which have not yet been scheduled. */
  public updateMetronomeSound(sound: MetronomeSound): boolean {
    if (!this.metronome || !practiceConfig.metronome.sounds[sound] || !this.getContext())
      return false
    this.metronome = { ...this.metronome, sound }
    return true
  }

  /** Applies the lower secondary tone to Beats which have not yet been scheduled. */
  public updateAlternateBeatTone(enabled: boolean): boolean {
    if (!this.metronome || !this.getContext()) return false
    this.metronome = { ...this.metronome, alternateBeatTone: enabled }
    return true
  }

  getBeatSnapshot = (): BeatSnapshot => this.beatClock.getSnapshot()

  subscribeToBeats = (listener: () => void): (() => void) => this.beatClock.subscribe(listener)

  /** Queues the Warning cue on the nearest Beat once that portion of the grid is known. */
  public scheduleWarningAt(delayMs: number): boolean {
    const context = this.getContext()
    if (!context || !this.metronome || !Number.isFinite(delayMs)) return false
    this.warningTargetTime = context.currentTime + Math.max(0, delayMs) / 1000
    this.cancelScheduledWarning()
    return true
  }

  /** Stops future scheduling and cancels clicks which have not started yet. */
  public pauseMetronome(): void {
    this.clearScheduler()
    this.cancelActiveSources()
    this.beatClock.stop()
  }

  /** Restarts from a new beat boundary; missed beats are deliberately not recreated. */
  public resumeMetronome(): boolean {
    if (!this.metronome || !this.getContext()) return false
    this.clearScheduler()
    this.cancelActiveSources()
    this.beatClock.start(this.metronome.bpm)
    this.lastScheduledBeatTime = null
    this.nextBeatTime = this.context!.currentTime + START_DELAY_SEC
    this.scheduleBeats()
    this.scheduler = this.setIntervalFn(() => this.scheduleBeats(), this.schedulerPollMs)
    return true
  }

  public stopMetronome(): void {
    this.clearScheduler()
    this.cancelActiveSources()
    this.beatClock.stop()
    this.metronome = undefined
    this.beatIndex = 0
    this.nextBeatTime = 0
    this.lastScheduledBeatTime = null
    this.warningTargetTime = null
    this.cancelScheduledWarning()
  }

  public setMetronomeVolume(volume: number): void {
    const gain = this.getMetronomeGain()
    if (gain) gain.gain.value = clampVolume(volume)
  }

  public setCueVolume(volume: number): void {
    const gain = this.getCueGain()
    if (gain) gain.gain.value = clampVolume(volume)
  }

  /** Plays a recognisably distinct generated tone pattern, independently of clicks. */
  public playCue(cue: AudioCue): boolean {
    const context = this.getContext()
    const gain = this.getCueGain()
    if (!context || !gain) return false

    const start = context.currentTime + 0.01
    this.scheduleCue(cue, start)
    return true
  }

  private scheduleCue(cue: AudioCue, start: number): OscillatorNode[] {
    const gain = this.getCueGain()
    if (!gain) return []
    const peak =
      cue === 'warning' ? practiceConfig.audio.warningPeak : practiceConfig.audio.completionPeak
    return cuePatterns[cue]
      .map((frequency, index) =>
        this.scheduleTone(frequency, start + index * 0.16, 0.1, gain, peak),
      )
      .filter((source): source is OscillatorNode => source !== undefined)
  }

  public dispose(): void {
    this.stopMetronome()
    this.metronomeGain?.disconnect()
    this.cueGain?.disconnect()
    this.metronomeGain = undefined
    this.cueGain = undefined
  }

  private scheduleBeats(): void {
    if (!this.context || !this.metronome) return
    const horizon = this.context.currentTime + this.scheduleAheadSec

    while (this.nextBeatTime <= horizon) {
      const metronome = this.metronome
      const positionInPattern = this.beatIndex % 4
      const accent: BeatAccent = positionInPattern % 2 === 0 ? 'primary' : 'secondary'
      const scheduledBeat = {
        time: this.nextBeatTime,
        beatIndex: this.beatIndex,
        positionInPattern,
        accent,
        tempoBpm: metronome.bpm,
      }
      this.scheduleClick(
        scheduledBeat.time,
        accent === 'secondary' && metronome.alternateBeatTone === true,
      )
      metronome.onBeatScheduled?.(scheduledBeat)
      this.beatClock.schedule(
        {
          ...scheduledBeat,
          audioTime: scheduledBeat.time,
        },
        (scheduledBeat.time - this.context.currentTime) * 1000,
      )
      this.scheduleWarningOnGrid(scheduledBeat.time, 60 / metronome.bpm)
      this.lastScheduledBeatTime = scheduledBeat.time
      this.beatIndex += 1
      this.nextBeatTime += 60 / metronome.bpm
    }
  }

  private scheduleClick(time: number, alternate: boolean): void {
    const gain = this.getMetronomeGain()
    const sound =
      practiceConfig.metronome.sounds[
        this.metronome?.sound ?? practiceConfig.metronome.defaultSound
      ]
    if (gain)
      this.scheduleTone(
        alternate ? sound.frequency * 2 ** (-3 / 12) : sound.frequency,
        time,
        sound.decay,
        gain,
        practiceConfig.audio.beatPeak,
        sound.waveform,
      )
  }

  private scheduleWarningOnGrid(beatTime: number, interval: number): void {
    if (this.warningTargetTime === null || this.warningScheduled || !this.context) return
    const nextBeatTime = beatTime + interval
    if (this.warningTargetTime < beatTime || this.warningTargetTime > nextBeatTime) return
    const cueTime =
      this.warningTargetTime - beatTime <= nextBeatTime - this.warningTargetTime
        ? beatTime
        : nextBeatTime
    if (cueTime < this.context.currentTime) return
    this.scheduleCue('warning', cueTime).forEach((source) => this.warningSources.add(source))
    this.warningScheduled = true
    this.warningAnchoredToScheduledBeat = cueTime === beatTime
  }

  private scheduleTone(
    frequency: number,
    time: number,
    duration: number,
    destination: GainNode,
    peak: number,
    waveform: OscillatorType = 'sine',
  ): OscillatorNode | undefined {
    const context = this.context
    if (!context) return undefined
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    oscillator.frequency.value = frequency
    oscillator.type = waveform
    envelope.gain.setValueAtTime(0.0001, time)
    envelope.gain.exponentialRampToValueAtTime(peak, time + 0.002)
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration)
    oscillator.connect(envelope)
    envelope.connect(destination)
    this.activeSources.add(oscillator)
    oscillator.onended = () => {
      this.activeSources.delete(oscillator)
      oscillator.disconnect()
      envelope.disconnect()
    }
    oscillator.start(time)
    oscillator.stop(time + duration + 0.01)
    return oscillator
  }

  private cancelScheduledWarning(): void {
    for (const source of this.warningSources) {
      try {
        source.stop()
      } catch {
        /* source has already stopped */
      }
    }
    this.warningSources.clear()
    this.warningScheduled = false
    this.warningAnchoredToScheduledBeat = false
  }

  private getContext(): AudioContext | undefined {
    if (this.context) return this.context
    this.context = this.contextFactory()
    return this.context
  }

  private getMetronomeGain(): GainNode | undefined {
    const context = this.getContext()
    if (!context) return undefined
    if (!this.metronomeGain) {
      this.metronomeGain = context.createGain()
      this.metronomeGain.gain.value = 1
      this.metronomeGain.connect(context.destination)
    }
    return this.metronomeGain
  }

  private getCueGain(): GainNode | undefined {
    const context = this.getContext()
    if (!context) return undefined
    if (!this.cueGain) {
      this.cueGain = context.createGain()
      this.cueGain.gain.value = 1
      this.cueGain.connect(context.destination)
    }
    return this.cueGain
  }

  private clearScheduler(): void {
    if (this.scheduler !== undefined) this.clearIntervalFn(this.scheduler)
    this.scheduler = undefined
  }

  private cancelActiveSources(): void {
    for (const source of this.activeSources) {
      try {
        source.stop()
      } catch {
        /* source has already stopped */
      }
    }
    this.activeSources.clear()
  }
}

function defaultContextFactory(): AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  const legacyWindow = window as typeof window & {
    webkitAudioContext?: typeof AudioContext
  }
  const Constructor = legacyWindow.AudioContext ?? legacyWindow.webkitAudioContext
  return Constructor ? new Constructor() : undefined
}

function isValidBpm(bpm: number): boolean {
  return Number.isFinite(bpm) && bpm >= practiceConfig.tempo.min && bpm <= practiceConfig.tempo.max
}

function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 1))
}
