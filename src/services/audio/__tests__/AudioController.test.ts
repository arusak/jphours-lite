import { describe, expect, it, vi } from "vitest";
import { AudioController } from "../AudioController";

type FakeContext = AudioContext & {
  now: number;
  state: AudioContextState;
  oscillators: FakeOscillator[];
  gains: FakeGain[];
};
type FakeOscillator = OscillatorNode & {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
};
type FakeGain = GainNode & {
  gain: AudioParam & {
    setValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
};

function makeContext(state: AudioContextState = "running"): FakeContext {
  const oscillators: FakeOscillator[] = [];
  const gains: FakeGain[] = [];
  const context = {
    now: 0,
    state,
    destination: {},
    resume: vi.fn(async () => {
      context.state = "running";
    }),
    createGain: vi.fn(() => {
      const gain = {
        gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      } as unknown as FakeGain;
      gains.push(gain);
      return gain;
    }),
    createOscillator: vi.fn(() => {
      const oscillator = {
        frequency: { value: 0 },
        type: "sine",
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      } as unknown as FakeOscillator;
      oscillators.push(oscillator);
      return oscillator;
    }),
    get currentTime() {
      return context.now;
    },
  } as unknown as FakeContext;
  context.oscillators = oscillators;
  context.gains = gains;
  return context;
}

describe("AudioController", () => {
  it("unlocks a suspended audio context from the explicit start gesture", async () => {
    const context = makeContext("suspended");
    const controller = new AudioController({ contextFactory: () => context });

    await expect(controller.unlock()).resolves.toBe(true);
    expect(context.resume).toHaveBeenCalledOnce();
  });

  it("schedules metronome beats against the audio clock without duplicate scheduling", () => {
    const context = makeContext();
    const intervals: Array<() => void> = [];
    const onBeatScheduled = vi.fn();
    const controller = new AudioController({
      contextFactory: () => context,
      setIntervalFn: ((callback: () => void) => {
        intervals.push(callback);
        return 1;
      }) as typeof setInterval,
      clearIntervalFn: vi.fn() as unknown as typeof clearInterval,
    });

    expect(controller.startMetronome({ bpm: 120, onBeatScheduled })).toBe(true);
    expect(onBeatScheduled).toHaveBeenCalledTimes(1);
    expect(onBeatScheduled).toHaveBeenLastCalledWith({ beat: 0, time: 0.05 });

    intervals[0]!();
    expect(onBeatScheduled).toHaveBeenCalledTimes(1);
    context.now = 0.45;
    intervals[0]!();
    expect(onBeatScheduled).toHaveBeenLastCalledWith({ beat: 1, time: 0.55 });
    expect(onBeatScheduled).toHaveBeenCalledTimes(2);
  });

  it("cancels scheduled sources and its polling timer when paused", () => {
    const context = makeContext();
    const clearIntervalFn = vi.fn();
    const controller = new AudioController({
      contextFactory: () => context,
      setIntervalFn: vi.fn(() => 7) as unknown as typeof setInterval,
      clearIntervalFn: clearIntervalFn as unknown as typeof clearInterval,
    });
    controller.startMetronome({ bpm: 120 });

    controller.pauseMetronome();
    expect(clearIntervalFn).toHaveBeenCalledWith(7);
    expect(context.oscillators[0]?.stop).toHaveBeenCalled();
  });

  it("keeps cue playback separate and gives each cue its own pitch pattern", () => {
    const context = makeContext();
    const controller = new AudioController({ contextFactory: () => context });

    expect(controller.playCue("session-complete")).toBe(true);
    expect(context.oscillators).toHaveLength(3);
    expect(context.oscillators.map((oscillator) => oscillator.frequency.value)).toEqual([
      660, 880, 1040,
    ]);
  });

  it("does not throw when Web Audio is unavailable or BPM is outside the supported range", () => {
    const controller = new AudioController({ contextFactory: () => undefined });
    expect(controller.startMetronome({ bpm: 120 })).toBe(false);
    expect(controller.playCue("warning")).toBe(false);

    const supported = new AudioController({ contextFactory: () => makeContext() });
    expect(supported.startMetronome({ bpm: 29 })).toBe(false);
  });
});
