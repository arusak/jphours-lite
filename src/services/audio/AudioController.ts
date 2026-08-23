import { practiceConfig, type MetronomeSound } from '../../config/practice-config'
import { BeatClock, type BeatAccent, type BeatSnapshot } from './BeatClock'
import type {
  AudioControllerOptions,
  AudioCue,
  AudioLifecycleSnapshot,
  MetronomeOptions,
} from './types'

const DEFAULT_POLL_MS = 25
const DEFAULT_SCHEDULE_AHEAD_SEC = 0.1
const DEFAULT_ACTIVATION_TIMEOUT_MS = 1_500
const START_DELAY_SEC = 0.05

const cuePatterns: Record<AudioCue, readonly number[]> = {
  warning: [660, 660],
  'exercise-complete': [660, 880],
  'break-complete': [880, 660, 880],
  'session-complete': [660, 880, 1040],
}

type ContextState = AudioContextState | 'interrupted'
type ContextRecord = { context: AudioContext; generation: number; onStateChange: () => void }
type ActiveSource = { oscillator: OscillatorNode; envelope: GainNode }
type Listener = () => void

/**
 * Owns one Web Audio context at a time. `ensureRunning()` is idempotent, must be
 * started from a user gesture, and always settles within its configured bound.
 */
export class AudioController {
  private readonly contextFactory: () => AudioContext | undefined
  private readonly setIntervalFn: typeof setInterval
  private readonly clearIntervalFn: typeof clearInterval
  private readonly setTimeoutFn: typeof setTimeout
  private readonly clearTimeoutFn: typeof clearTimeout
  private readonly schedulerPollMs: number
  private readonly scheduleAheadSec: number
  private readonly activationTimeoutMs: number
  private record?: ContextRecord
  private activation?: Promise<boolean>
  private snapshot: AudioLifecycleSnapshot = { status: 'idle', generation: 0 }
  private readonly stateListeners = new Set<Listener>()
  private metronomeGain?: GainNode
  private cueGain?: GainNode
  private scheduler?: ReturnType<typeof setInterval>
  private nextBeatTime = 0
  private lastScheduledBeatTime: number | null = null
  private beatIndex = 0
  private metronome?: MetronomeOptions
  private readonly activeSources = new Set<ActiveSource>()
  private readonly beatClock = new BeatClock()
  private warningTargetTime: number | null = null
  private warningScheduled = false
  private warningAnchoredToScheduledBeat = false
  private readonly warningSources = new Set<OscillatorNode>()

  public constructor(options: AudioControllerOptions = {}) {
    this.contextFactory = options.contextFactory ?? defaultContextFactory
    this.setIntervalFn = options.setIntervalFn ?? globalThis.setInterval.bind(globalThis)
    this.clearIntervalFn = options.clearIntervalFn ?? globalThis.clearInterval.bind(globalThis)
    this.setTimeoutFn = options.setTimeoutFn ?? globalThis.setTimeout.bind(globalThis)
    this.clearTimeoutFn = options.clearTimeoutFn ?? globalThis.clearTimeout.bind(globalThis)
    this.schedulerPollMs = options.schedulerPollMs ?? DEFAULT_POLL_MS
    this.scheduleAheadSec = options.scheduleAheadSec ?? DEFAULT_SCHEDULE_AHEAD_SEC
    this.activationTimeoutMs = options.activationTimeoutMs ?? DEFAULT_ACTIVATION_TIMEOUT_MS
  }

  public getStateSnapshot = (): AudioLifecycleSnapshot => this.snapshot

  public subscribeToState = (listener: Listener): (() => void) => {
    this.stateListeners.add(listener)
    return () => this.stateListeners.delete(listener)
  }

  /** Starts or recovers Web Audio. Concurrent calls share one bounded attempt. */
  public ensureRunning(): Promise<boolean> {
    const record = this.record
    if (record && isRunning(record.context)) {
      this.publish('running', record.generation)
      return Promise.resolve(true)
    }
    if (this.activation) return this.activation

    const activation = this.activate()
    this.activation = activation
    void activation.finally(() => {
      if (this.activation === activation) this.activation = undefined
    })
    return activation
  }

  public startMetronome(options: MetronomeOptions): boolean {
    const context = this.getRunningContext()
    if (!isValidBpm(options.bpm) || !context) return false

    this.stopMetronome()
    this.metronome = {
      ...options,
      sound: options.sound ?? practiceConfig.metronome.defaultSound,
      alternateBeatTone: options.alternateBeatTone ?? true,
    }
    this.beatIndex = 0
    this.lastScheduledBeatTime = null
    this.beatClock.start(options.bpm)
    this.nextBeatTime = context.currentTime + START_DELAY_SEC
    this.scheduleBeats()
    this.scheduler = this.setIntervalFn(() => this.scheduleBeats(), this.schedulerPollMs)
    return true
  }

  /** Applies Tempo after the next already-planned boundary without restarting the grid. */
  public updateMetronomeTempo(bpm: number): boolean {
    const context = this.getRunningContext()
    if (!isValidBpm(bpm) || !this.metronome || !context) return false
    if (this.warningScheduled && !this.warningAnchoredToScheduledBeat) this.cancelScheduledWarning()
    this.metronome = { ...this.metronome, bpm }
    if (this.lastScheduledBeatTime !== null && this.lastScheduledBeatTime > context.currentTime)
      this.nextBeatTime = this.lastScheduledBeatTime + 60 / bpm
    return true
  }

  public updateMetronomeSound(sound: MetronomeSound): boolean {
    if (!this.metronome || !practiceConfig.metronome.sounds[sound] || !this.getRunningContext())
      return false
    this.metronome = { ...this.metronome, sound }
    return true
  }

  public updateAlternateBeatTone(enabled: boolean): boolean {
    if (!this.metronome || !this.getRunningContext()) return false
    this.metronome = { ...this.metronome, alternateBeatTone: enabled }
    return true
  }

  getBeatSnapshot = (): BeatSnapshot => this.beatClock.getSnapshot()

  subscribeToBeats = (listener: Listener): (() => void) => this.beatClock.subscribe(listener)

  public scheduleWarningAt(delayMs: number): boolean {
    const context = this.getRunningContext()
    if (!context || !this.metronome || !Number.isFinite(delayMs)) return false
    this.warningTargetTime = context.currentTime + Math.max(0, delayMs) / 1000
    this.cancelScheduledWarning()
    return true
  }

  public pauseMetronome(): void {
    this.clearScheduler()
    this.cancelActiveSources()
    this.beatClock.stop()
  }

  public resumeMetronome(): boolean {
    const context = this.getRunningContext()
    if (!this.metronome || !context) return false
    this.clearScheduler()
    this.cancelActiveSources()
    this.beatClock.start(this.metronome.bpm)
    this.lastScheduledBeatTime = null
    this.nextBeatTime = context.currentTime + START_DELAY_SEC
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

  public playCue(cue: AudioCue): boolean {
    const context = this.getRunningContext()
    const gain = this.getCueGain()
    if (!context || !gain) return false
    this.scheduleCue(cue, context.currentTime + 0.01)
    return true
  }

  /** Safe under repeated calls; later activation creates a fresh context. */
  public dispose(): void {
    if (this.record) this.retire(this.record)
    else if (this.snapshot.status === 'idle') return
    else this.stopMetronome()
    this.activation = undefined
    this.publish('idle', this.snapshot.generation + 1)
  }

  private async activate(): Promise<boolean> {
    let record = this.record ?? this.createContext()
    if (record && (await this.activateRecord(record))) return true

    if (record) this.retire(record)
    record = this.createContext()
    if (record && (await this.activateRecord(record))) return true

    if (record && this.isCurrent(record)) this.retire(record)
    this.publish('unavailable', this.snapshot.generation)
    return false
  }

  private createContext(): ContextRecord | undefined {
    let context: AudioContext | undefined
    try {
      context = this.contextFactory()
    } catch {
      return undefined
    }
    if (!context) return undefined
    const generation = this.snapshot.generation + 1
    const record: ContextRecord = {
      context,
      generation,
      onStateChange: () => this.handleStateChange(record),
    }
    this.record = record
    context.addEventListener?.('statechange', record.onStateChange)
    this.publish('activating', generation)
    return record
  }

  private async activateRecord(record: ContextRecord): Promise<boolean> {
    if (!this.isCurrent(record)) return false
    if (isRunning(record.context)) {
      this.publish('running', record.generation)
      return true
    }
    const state = record.context.state as ContextState
    if (state !== 'suspended' && state !== 'interrupted') return false

    this.publish('activating', record.generation)
    const resumed = await this.withTimeout(Promise.resolve().then(() => record.context.resume()))
    if (!resumed || !this.isCurrent(record) || !isRunning(record.context)) return false
    this.publish('running', record.generation)
    return true
  }

  private async withTimeout(operation: Promise<unknown>): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        operation.then(
          () => true,
          () => false,
        ),
        new Promise<boolean>((resolve) => {
          timer = this.setTimeoutFn(() => resolve(false), this.activationTimeoutMs)
        }),
      ])
      return result
    } finally {
      if (timer !== undefined) this.clearTimeoutFn(timer)
    }
  }

  private handleStateChange(record: ContextRecord): void {
    if (!this.isCurrent(record)) return
    if (isRunning(record.context)) {
      this.publish('running', record.generation)
      return
    }
    if (record.context.state === 'closed') {
      this.retire(record)
      this.publish('unavailable', this.snapshot.generation)
      return
    }
    this.pauseMetronome()
    this.publish('unavailable', record.generation)
  }

  private retire(record: ContextRecord): void {
    if (!this.isCurrent(record)) return
    this.stopMetronome()
    record.context.removeEventListener?.('statechange', record.onStateChange)
    this.metronomeGain?.disconnect()
    this.cueGain?.disconnect()
    this.metronomeGain = undefined
    this.cueGain = undefined
    this.record = undefined
    this.snapshot = { ...this.snapshot, generation: record.generation + 1 }
    try {
      void Promise.resolve(record.context.close()).catch(() => undefined)
    } catch {
      // Closing is best-effort; a retired context must never escape this controller.
    }
  }

  private isCurrent(record: ContextRecord): boolean {
    return this.record === record && this.snapshot.generation === record.generation
  }

  private publish(status: AudioLifecycleSnapshot['status'], generation: number): void {
    if (this.snapshot.status === status && this.snapshot.generation === generation) return
    this.snapshot = { status, generation }
    this.stateListeners.forEach((listener) => listener())
  }

  private getRunningContext(): AudioContext | undefined {
    const record = this.record ?? this.createContext()
    if (!record || !isRunning(record.context)) return undefined
    this.publish('running', record.generation)
    return record.context
  }

  private scheduleBeats(): void {
    const context = this.getRunningContext()
    if (!context || !this.metronome) return
    const horizon = context.currentTime + this.scheduleAheadSec
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
        { ...scheduledBeat, audioTime: scheduledBeat.time },
        (scheduledBeat.time - context.currentTime) * 1000,
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
    const context = this.getRunningContext()
    if (this.warningTargetTime === null || this.warningScheduled || !context) return
    const nextBeatTime = beatTime + interval
    if (this.warningTargetTime < beatTime || this.warningTargetTime > nextBeatTime) return
    const cueTime =
      this.warningTargetTime - beatTime <= nextBeatTime - this.warningTargetTime
        ? beatTime
        : nextBeatTime
    if (cueTime < context.currentTime) return
    this.scheduleCue('warning', cueTime).forEach((source) => this.warningSources.add(source))
    this.warningScheduled = true
    this.warningAnchoredToScheduledBeat = cueTime === beatTime
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

  private scheduleTone(
    frequency: number,
    time: number,
    duration: number,
    destination: GainNode,
    peak: number,
    waveform: OscillatorType = 'sine',
  ): OscillatorNode | undefined {
    const context = this.getRunningContext()
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
    const activeSource = { oscillator, envelope }
    this.activeSources.add(activeSource)
    oscillator.onended = () => {
      this.activeSources.delete(activeSource)
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
        /* already stopped */
      }
    }
    this.warningSources.clear()
    this.warningScheduled = false
    this.warningAnchoredToScheduledBeat = false
  }

  private getMetronomeGain(): GainNode | undefined {
    const context = this.getRunningContext()
    if (!context) return undefined
    if (!this.metronomeGain) {
      this.metronomeGain = context.createGain()
      this.metronomeGain.gain.value = 1
      this.metronomeGain.connect(context.destination)
    }
    return this.metronomeGain
  }

  private getCueGain(): GainNode | undefined {
    const context = this.getRunningContext()
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
    for (const { oscillator, envelope } of this.activeSources) {
      try {
        oscillator.stop()
      } catch {
        /* already stopped */
      }
      oscillator.disconnect()
      envelope.disconnect()
    }
    this.activeSources.clear()
  }
}

function defaultContextFactory(): AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  const legacyWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext }
  const Constructor = legacyWindow.AudioContext ?? legacyWindow.webkitAudioContext
  return Constructor ? new Constructor() : undefined
}

function isValidBpm(bpm: number): boolean {
  return Number.isFinite(bpm) && bpm >= practiceConfig.tempo.min && bpm <= practiceConfig.tempo.max
}
function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 1))
}
function isRunning(context: AudioContext | undefined): boolean {
  return (context?.state as ContextState | undefined) === 'running'
}
