import type { MetronomeSound } from '../../config/practice-config'
import type { BeatAccent, BeatSnapshot } from './BeatClock'

export type AudioCue = 'warning' | 'exercise-complete' | 'break-complete' | 'session-complete'

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
}
