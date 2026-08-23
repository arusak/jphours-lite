import type { MetronomeSound } from '../../config/practice-config'
import type { BeatAccent, BeatSnapshot } from './BeatClock'

export type AudioCue = 'warning' | 'exercise-complete' | 'break-complete' | 'session-complete'

export type AudioLifecycleStatus = 'idle' | 'activating' | 'running' | 'unavailable'

/** The externally observable readiness of the controller's current Web Audio context. */
export interface AudioLifecycleSnapshot {
  status: AudioLifecycleStatus
  /** Changes whenever a context is created or retired, so stale work can be ignored. */
  generation: number
}

export interface MetronomeOptions {
  bpm: number
  sound?: MetronomeSound
  alternateBeatTone?: boolean
  onBeatScheduled?: (beat: ScheduledBeat) => void
}

export interface ScheduledBeat {
  time: number
  beatIndex: number
  positionInPattern: number
  accent: BeatAccent
  tempoBpm: number
}

export type { BeatAccent, BeatSnapshot }

export interface AudioControllerOptions {
  contextFactory?: () => AudioContext | undefined
  setIntervalFn?: typeof setInterval
  clearIntervalFn?: typeof clearInterval
  schedulerPollMs?: number
  scheduleAheadSec?: number
  /** Bounds one resume or replacement attempt. `ensureRunning()` always settles within this bound. */
  activationTimeoutMs?: number
  setTimeoutFn?: typeof setTimeout
  clearTimeoutFn?: typeof clearTimeout
}
