export type AudioCue = "warning" | "exercise-complete" | "break-complete" | "session-complete";

export interface MetronomeOptions {
  bpm: number;
  onBeatScheduled?: (beat: ScheduledBeat) => void;
}

export interface ScheduledBeat {
  time: number;
  beat: number;
}

export interface AudioControllerOptions {
  contextFactory?: () => AudioContext | undefined;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  schedulerPollMs?: number;
  scheduleAheadSec?: number;
}
