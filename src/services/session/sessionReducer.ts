import type { Routine } from "../../domain/routine";
import { isTimedStep, type SessionStep } from "../../domain/session";
import { buildSessionSteps } from "./buildSessionSteps";

export type SessionStatus = "idle" | "running" | "paused" | "completed" | "stopped" | "interrupted";

export interface SessionState {
  status: SessionStatus;
  steps: SessionStep[];
  currentStepIndex: number | null;
  currentStepStartedAt: number | null;
  currentStepEndsAt: number | null;
  pausedRemainingSec: number | null;
  pausedElapsedSec: number | null;
  warningPlayedForStepId: string | null;
}

export type SessionCommand =
  | { type: "START"; routine: Routine; now: number }
  | { type: "PAUSE"; now: number }
  | { type: "RESUME"; now: number }
  | { type: "SKIP_STEP"; now: number }
  | { type: "REWIND_BREAK"; now: number }
  | { type: "STOP" }
  | { type: "STEP_WARNING"; stepId: string }
  | { type: "STEP_COMPLETED"; stepId: string; now: number }
  | { type: "APP_HIDDEN"; now: number }
  | { type: "APP_VISIBLE" };

export const initialSessionState: SessionState = {
  status: "idle",
  steps: [],
  currentStepIndex: null,
  currentStepStartedAt: null,
  currentStepEndsAt: null,
  pausedRemainingSec: null,
  pausedElapsedSec: null,
  warningPlayedForStepId: null,
};

export function sessionReducer(state: SessionState, command: SessionCommand): SessionState {
  switch (command.type) {
    case "START":
      return enterStep(buildSessionSteps(command.routine), 0, command.now);
    case "PAUSE":
    case "APP_HIDDEN":
      return pause(state, command.now, command.type === "APP_HIDDEN" ? "interrupted" : "paused");
    case "RESUME":
      return resume(state, command.now);
    case "APP_VISIBLE":
      return state;
    case "SKIP_STEP":
      return state.status === "running" ? advance(state, command.now) : state;
    case "REWIND_BREAK":
      return rewindBreak(state, command.now);
    case "STEP_WARNING":
      return canEmitForCurrentTimedStep(state, command.stepId) &&
        state.warningPlayedForStepId !== command.stepId
        ? { ...state, warningPlayedForStepId: command.stepId }
        : state;
    case "STEP_COMPLETED":
      return canEmitForCurrentTimedStep(state, command.stepId)
        ? advance(state, command.now)
        : state;
    case "STOP":
      return state.status === "idle" ? state : { ...initialSessionState, status: "stopped" };
  }
}

function rewindBreak(state: SessionState, now: number): SessionState {
  const step = currentStep(state);
  if (state.status !== "running" || step?.kind !== "break" || state.currentStepIndex === null) {
    return state;
  }
  const precedingIndex = state.currentStepIndex - 1;
  const precedingStep = state.steps[precedingIndex];
  return precedingStep?.kind === "exercise" ? enterStep(state.steps, precedingIndex, now) : state;
}

export function currentStep(state: SessionState): SessionStep | null {
  return state.currentStepIndex === null ? null : (state.steps[state.currentStepIndex] ?? null);
}

function pause(state: SessionState, now: number, status: "paused" | "interrupted"): SessionState {
  if (state.status !== "running") return state;
  const step = currentStep(state);
  const remainingSec =
    step && isTimedStep(step) && state.currentStepEndsAt !== null
      ? Math.max(0, (state.currentStepEndsAt - now) / 1000)
      : null;
  return {
    ...state,
    status,
    currentStepEndsAt: null,
    pausedRemainingSec: remainingSec,
    pausedElapsedSec:
      state.currentStepStartedAt === null
        ? 0
        : Math.max(0, (now - state.currentStepStartedAt) / 1000),
  };
}

function resume(state: SessionState, now: number): SessionState {
  if (state.status !== "paused" && state.status !== "interrupted") return state;
  const step = currentStep(state);
  if (!step) return state;
  const remainingSec = isTimedStep(step) ? (state.pausedRemainingSec ?? step.durationSec) : null;
  return {
    ...state,
    status: "running",
    currentStepStartedAt: now - (state.pausedElapsedSec ?? 0) * 1000,
    currentStepEndsAt: remainingSec === null ? null : now + remainingSec * 1000,
    pausedRemainingSec: null,
    pausedElapsedSec: null,
  };
}

function advance(state: SessionState, now: number): SessionState {
  const nextIndex = (state.currentStepIndex ?? -1) + 1;
  return nextIndex < state.steps.length
    ? enterStep(state.steps, nextIndex, now)
    : { ...initialSessionState, steps: state.steps, status: "completed" };
}

function enterStep(steps: SessionStep[], index: number, now: number): SessionState {
  const step = steps[index];
  const durationSec = step.kind === "break" ? step.durationSec : step.durationSec;
  return {
    status: "running",
    steps,
    currentStepIndex: index,
    currentStepStartedAt: now,
    currentStepEndsAt: durationSec === null ? null : now + durationSec * 1000,
    pausedRemainingSec: null,
    pausedElapsedSec: null,
    warningPlayedForStepId: null,
  };
}

function canEmitForCurrentTimedStep(state: SessionState, stepId: string): boolean {
  const step = currentStep(state);
  return state.status === "running" && step?.id === stepId && isTimedStep(step);
}
