import { practiceConfig, type MetronomeSound } from "../../config/practice-config";
import type { AudioControllerOptions, AudioCue, MetronomeOptions } from "./types";

const DEFAULT_POLL_MS = 25;
const DEFAULT_SCHEDULE_AHEAD_SEC = 0.1;
const START_DELAY_SEC = 0.05;

const cuePatterns: Record<AudioCue, readonly number[]> = {
  warning: [660, 660],
  "exercise-complete": [660, 880],
  "break-complete": [880, 660, 880],
  "session-complete": [660, 880, 1040],
};

/**
 * Owns the single Web Audio context used by a session. Beats are scheduled against
 * the audio clock; the browser timer merely fills a small look-ahead window.
 */
export class AudioController {
  private readonly contextFactory: () => AudioContext | undefined;
  private readonly setIntervalFn: typeof setInterval;
  private readonly clearIntervalFn: typeof clearInterval;
  private readonly schedulerPollMs: number;
  private readonly scheduleAheadSec: number;
  private context?: AudioContext;
  private metronomeGain?: GainNode;
  private cueGain?: GainNode;
  private scheduler?: ReturnType<typeof setInterval>;
  private nextBeatTime = 0;
  private beat = 0;
  private metronome?: MetronomeOptions;
  private readonly activeSources = new Set<OscillatorNode>();

  public constructor(options: AudioControllerOptions = {}) {
    this.contextFactory = options.contextFactory ?? defaultContextFactory;
    this.setIntervalFn = options.setIntervalFn ?? window.setInterval.bind(window);
    this.clearIntervalFn = options.clearIntervalFn ?? window.clearInterval.bind(window);
    this.schedulerPollMs = options.schedulerPollMs ?? DEFAULT_POLL_MS;
    this.scheduleAheadSec = options.scheduleAheadSec ?? DEFAULT_SCHEDULE_AHEAD_SEC;
  }

  /** Must be called from a user gesture (for example, Start session). */
  public async unlock(): Promise<boolean> {
    const context = this.getContext();
    if (!context) return false;

    try {
      if (context.state === "suspended") await context.resume();
      return context.state === "running";
    } catch {
      return false;
    }
  }

  public startMetronome(options: MetronomeOptions): boolean {
    if (!isValidBpm(options.bpm) || !this.getContext()) return false;

    this.stopMetronome();
    this.metronome = { ...options, sound: options.sound ?? practiceConfig.metronome.defaultSound };
    this.beat = 0;
    this.nextBeatTime = this.context!.currentTime + START_DELAY_SEC;
    this.scheduleBeats();
    const fn = () => this.scheduleBeats();
    this.scheduler = this.setIntervalFn(fn, this.schedulerPollMs);
    return true;
  }

  /** Applies a session-only tempo and drops clicks queued at the old tempo. */
  public updateMetronomeTempo(bpm: number): boolean {
    if (!isValidBpm(bpm) || !this.metronome || !this.getContext()) return false;
    this.clearScheduler();
    this.cancelActiveSources();
    this.metronome = { ...this.metronome, bpm };
    this.nextBeatTime = this.context!.currentTime + START_DELAY_SEC;
    this.scheduleBeats();
    this.scheduler = this.setIntervalFn(() => this.scheduleBeats(), this.schedulerPollMs);
    return true;
  }

  /** Applies a session-only sound preset and drops clicks queued with the old sound. */
  public updateMetronomeSound(sound: MetronomeSound): boolean {
    if (!this.metronome || !practiceConfig.metronome.sounds[sound] || !this.getContext())
      return false;
    this.restartMetronome({ ...this.metronome, sound });
    return true;
  }

  /** Stops future scheduling and cancels clicks which have not started yet. */
  public pauseMetronome(): void {
    this.clearScheduler();
    this.cancelActiveSources();
  }

  /** Restarts from a new beat boundary; missed beats are deliberately not recreated. */
  public resumeMetronome(): boolean {
    if (!this.metronome || !this.getContext()) return false;
    this.clearScheduler();
    this.cancelActiveSources();
    this.nextBeatTime = this.context!.currentTime + START_DELAY_SEC;
    this.scheduleBeats();
    this.scheduler = this.setIntervalFn(() => this.scheduleBeats(), this.schedulerPollMs);
    return true;
  }

  public stopMetronome(): void {
    this.clearScheduler();
    this.cancelActiveSources();
    this.metronome = undefined;
    this.beat = 0;
    this.nextBeatTime = 0;
  }

  public setMetronomeVolume(volume: number): void {
    const gain = this.getMetronomeGain();
    if (gain) gain.gain.value = clampVolume(volume);
  }

  public setCueVolume(volume: number): void {
    const gain = this.getCueGain();
    if (gain) gain.gain.value = clampVolume(volume);
  }

  /** Plays a recognisably distinct generated tone pattern, independently of clicks. */
  public playCue(cue: AudioCue): boolean {
    const context = this.getContext();
    const gain = this.getCueGain();
    if (!context || !gain) return false;

    const start = context.currentTime + 0.01;
    const peak =
      cue === "warning" ? practiceConfig.audio.warningPeak : practiceConfig.audio.completionPeak;
    cuePatterns[cue].forEach((frequency, index) => {
      this.scheduleTone(frequency, start + index * 0.16, 0.1, gain, peak);
    });
    return true;
  }

  public dispose(): void {
    this.stopMetronome();
    this.metronomeGain?.disconnect();
    this.cueGain?.disconnect();
    this.metronomeGain = undefined;
    this.cueGain = undefined;
  }

  private scheduleBeats(): void {
    if (!this.context || !this.metronome) return;
    const interval = 60 / this.metronome.bpm;
    const horizon = this.context.currentTime + this.scheduleAheadSec;

    while (this.nextBeatTime <= horizon) {
      this.scheduleClick(this.nextBeatTime);
      this.metronome.onBeatScheduled?.({
        time: this.nextBeatTime,
        beat: this.beat++,
      });
      this.nextBeatTime += interval;
    }
  }

  private scheduleClick(time: number): void {
    const gain = this.getMetronomeGain();
    const sound =
      practiceConfig.metronome.sounds[
        this.metronome?.sound ?? practiceConfig.metronome.defaultSound
      ];
    if (gain)
      this.scheduleTone(
        sound.frequency,
        time,
        sound.decay,
        gain,
        practiceConfig.audio.beatPeak,
        sound.waveform,
      );
  }

  private scheduleTone(
    frequency: number,
    time: number,
    duration: number,
    destination: GainNode,
    peak: number,
    waveform: OscillatorType = "sine",
  ): void {
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = waveform;
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(peak, time + 0.002);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(envelope);
    envelope.connect(destination);
    this.activeSources.add(oscillator);
    oscillator.onended = () => {
      this.activeSources.delete(oscillator);
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(time);
    oscillator.stop(time + duration + 0.01);
  }

  private getContext(): AudioContext | undefined {
    if (this.context) return this.context;
    this.context = this.contextFactory();
    return this.context;
  }

  private getMetronomeGain(): GainNode | undefined {
    const context = this.getContext();
    if (!context) return undefined;
    if (!this.metronomeGain) {
      this.metronomeGain = context.createGain();
      this.metronomeGain.gain.value = 1;
      this.metronomeGain.connect(context.destination);
    }
    return this.metronomeGain;
  }

  private getCueGain(): GainNode | undefined {
    const context = this.getContext();
    if (!context) return undefined;
    if (!this.cueGain) {
      this.cueGain = context.createGain();
      this.cueGain.gain.value = 1;
      this.cueGain.connect(context.destination);
    }
    return this.cueGain;
  }

  private clearScheduler(): void {
    if (this.scheduler !== undefined) this.clearIntervalFn(this.scheduler);
    this.scheduler = undefined;
  }

  private restartMetronome(options: MetronomeOptions): void {
    this.clearScheduler();
    this.cancelActiveSources();
    this.metronome = options;
    this.nextBeatTime = this.context!.currentTime + START_DELAY_SEC;
    this.scheduleBeats();
    this.scheduler = this.setIntervalFn(() => this.scheduleBeats(), this.schedulerPollMs);
  }

  private cancelActiveSources(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        /* source has already stopped */
      }
    }
    this.activeSources.clear();
  }
}

function defaultContextFactory(): AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  const legacyWindow = window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const Constructor = legacyWindow.AudioContext ?? legacyWindow.webkitAudioContext;
  return Constructor ? new Constructor() : undefined;
}

function isValidBpm(bpm: number): boolean {
  return Number.isFinite(bpm) && bpm >= 20 && bpm <= 300;
}

function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 1));
}
