import { describe, expect, it, vi } from "vitest";
import type { Routine } from "../../domain/routine";
import { buildSessionSteps } from "./buildSessionSteps";
import { SessionRunner, type Clock, type TimeoutScheduler } from "./SessionRunner";

const routine = (exercises: Routine["exercises"], defaultBreakDurationSec = 10): Routine => ({
  schemaVersion: 1,
  id: "routine-1",
  name: "Warmup",
  exercises,
  defaultBreakDurationSec,
  warningLeadTimeSec: 20,
  autoAdvance: true,
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const exercise = (id: string, tempoBpm: number | null, durationSec: number | null) => ({
  id,
  title: `Exercise ${id}`,
  tempoBpm,
  durationSec,
});

class FakeTime implements Clock, TimeoutScheduler {
  value = 0;
  private nextId = 1;
  private timers = new Map<number, { at: number; callback: () => void }>();
  now = (): number => this.value;
  setTimeout(callback: () => void, delayMs: number): number {
    const id = this.nextId++;
    this.timers.set(id, { at: this.value + delayMs, callback });
    return id;
  }
  clearTimeout(handle: unknown): void { this.timers.delete(handle as number); }
  advance(milliseconds: number): void {
    const target = this.value + milliseconds;
    while (true) {
      const next = [...this.timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > target) break;
      this.value = next[1].at;
      this.timers.delete(next[0]);
      next[1].callback();
    }
    this.value = target;
  }
}

describe("buildSessionSteps", () => {
  it("derives executable modes and only inserts intermediate non-zero breaks", () => {
    const steps = buildSessionSteps(routine([
      exercise("paced", 120, 30), exercise("free", null, 30), exercise("open", null, null),
    ]));
    expect(steps.map((step) => step.kind === "exercise" ? step.mode : step.kind)).toEqual([
      "paced-timed", "break", "free-timed", "break", "open-ended",
    ]);
    expect(buildSessionSteps(routine([exercise("one", null, null)], 0))).toHaveLength(1);
  });

  it("rejects a tempo without a duration", () => {
    expect(() => buildSessionSteps(routine([exercise("invalid", 100, null)]))).toThrow(/tempo/i);
  });
});

describe("SessionRunner", () => {
  it("starts at the first step, warns once, and ignores stale completion", () => {
    const time = new FakeTime();
    const warning = vi.fn();
    const runner = new SessionRunner(time, time, { onWarning: warning });
    runner.start(routine([exercise("one", null, 25), exercise("two", null, null)]));
    expect(runner.getState().currentStepIndex).toBe(0);
    time.advance(5_000);
    expect(warning).toHaveBeenCalledTimes(1);
    runner.skipStep();
    expect(runner.getState().currentStepIndex).toBe(1);
    runner.dispatch({ type: "STEP_COMPLETED", stepId: "exercise:one", now: time.now() });
    expect(runner.getState().currentStepIndex).toBe(1);
  });

  it("does not auto-complete open-ended work and pauses/resumes a timed step", () => {
    const time = new FakeTime();
    const runner = new SessionRunner(time, time);
    runner.start(routine([exercise("open", null, null)]));
    runner.dispatch({ type: "STEP_COMPLETED", stepId: "exercise:open", now: time.now() });
    expect(runner.getState().status).toBe("running");

    runner.start(routine([exercise("timed", null, 10)]));
    time.advance(3_000);
    runner.pause();
    expect(runner.getState().pausedRemainingSec).toBe(7);
    time.advance(20_000);
    expect(runner.getState().status).toBe("paused");
    runner.resume();
    time.advance(7_000);
    expect(runner.getState().status).toBe("completed");
  });
});
