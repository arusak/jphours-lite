import type { Routine } from "../../domain/routine";
import { isTimedStep, type SessionStep } from "../../domain/session";
import {
  currentStep,
  initialSessionState,
  sessionReducer,
  type SessionCommand,
  type SessionState,
} from "./sessionReducer";

export interface Clock {
  now(): number;
}

export interface TimeoutScheduler {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** Adapter boundary for audio and UI integration. All methods are optional. */
export interface SessionRunnerHooks {
  onStateChange?(state: SessionState): void;
  onStepStart?(step: SessionStep, state: SessionState): void;
  onStepStop?(step: SessionStep, reason: SessionCommand["type"] | "DISPOSE"): void;
  onWarning?(step: SessionStep): void;
  onSessionComplete?(): void;
}

const warningLeadMs = 20_000;

/**
 * Owns timer callbacks and feeds only step-id-tagged events into the reducer.
 * Its dependencies make timer/audio behaviour deterministic in tests.
 */
export class SessionRunner {
  private state: SessionState = initialSessionState;
  private warningTimer: unknown | null = null;
  private completionTimer: unknown | null = null;

  constructor(
    private readonly clock: Clock = { now: () => performance.now() },
    private readonly scheduler: TimeoutScheduler = window,
    private readonly hooks: SessionRunnerHooks = {},
  ) {}

  getState(): SessionState {
    return this.state;
  }

  start(routine: Routine): void { this.dispatch({ type: "START", routine, now: this.clock.now() }); }
  pause(): void { this.dispatch({ type: "PAUSE", now: this.clock.now() }); }
  resume(): void { this.dispatch({ type: "RESUME", now: this.clock.now() }); }
  skipStep(): void { this.dispatch({ type: "SKIP_STEP", now: this.clock.now() }); }
  stop(): void { this.dispatch({ type: "STOP" }); }
  appHidden(): void { this.dispatch({ type: "APP_HIDDEN", now: this.clock.now() }); }
  appVisible(): void { this.dispatch({ type: "APP_VISIBLE" }); }

  dispatch(command: SessionCommand): void {
    const previous = this.state;
    const previousStep = currentStep(previous);
    this.state = sessionReducer(previous, command);
    const nextStep = currentStep(this.state);

    // START creates a new immutable snapshot, even when it happens to reuse an
    // exercise id, so its old callbacks/audio must never survive.
    if (previousStep && (previousStep.id !== nextStep?.id || this.state.status !== "running" || command.type === "START")) {
      this.cancelTimers();
      this.hooks.onStepStop?.(previousStep, command.type);
    }

    if (command.type === "STEP_WARNING" && previous.warningPlayedForStepId !== this.state.warningPlayedForStepId && nextStep) {
      this.hooks.onWarning?.(nextStep);
    }

    if (nextStep && this.state.status === "running" && (previousStep?.id !== nextStep.id || previous.status !== "running" || command.type === "START")) {
      this.hooks.onStepStart?.(nextStep, this.state);
      this.scheduleCurrentStep();
    }

    if (previous.status !== "completed" && this.state.status === "completed") {
      this.hooks.onSessionComplete?.();
    }
    if (previous !== this.state) this.hooks.onStateChange?.(this.state);
  }

  dispose(): void {
    const step = currentStep(this.state);
    this.cancelTimers();
    if (step) this.hooks.onStepStop?.(step, "DISPOSE");
    this.state = initialSessionState;
  }

  private scheduleCurrentStep(): void {
    const step = currentStep(this.state);
    const endsAt = this.state.currentStepEndsAt;
    if (!step || !isTimedStep(step) || endsAt === null) return;

    const remainingMs = Math.max(0, endsAt - this.clock.now());
    if (step.kind === "exercise" && step.durationSec! * 1000 > warningLeadMs && this.state.warningPlayedForStepId !== step.id) {
      const warningDelayMs = remainingMs - warningLeadMs;
      if (warningDelayMs > 0) {
        this.warningTimer = this.scheduler.setTimeout(() => {
          this.dispatch({ type: "STEP_WARNING", stepId: step.id });
        }, warningDelayMs);
      }
    }
    this.completionTimer = this.scheduler.setTimeout(() => {
      this.dispatch({ type: "STEP_COMPLETED", stepId: step.id, now: this.clock.now() });
    }, remainingMs);
  }

  private cancelTimers(): void {
    if (this.warningTimer !== null) this.scheduler.clearTimeout(this.warningTimer);
    if (this.completionTimer !== null) this.scheduler.clearTimeout(this.completionTimer);
    this.warningTimer = null;
    this.completionTimer = null;
  }
}
