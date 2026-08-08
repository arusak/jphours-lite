export type AudioCue = 'warning' | 'exercise-complete' | 'break-complete' | 'session-complete'

export interface MetronomeOptions {
  bpm: number
  sound?: MetronomeSound
  onBeatScheduled?: (beat: ScheduledBeat) => void
}

export interface ScheduledBeat {
  time: number
  beat: number
}

export interface AudioControllerOptions {
  contextFactory?: () => AudioContext | undefined
  setIntervalFn?: typeof setInterval
  clearIntervalFn?: typeof clearInterval
  schedulerPollMs?: number
  scheduleAheadSec?: number
}
import type { MetronomeSound } from '../../config/practice-config'
