import type { ExerciseMode } from "./routine";

export type { ExerciseMode } from "./routine";

export interface ExerciseStep {
  id: string;
  kind: "exercise";
  sourceExerciseId: string;
  title: string;
  mode: ExerciseMode;
  tempoBpm: number | null;
  durationSec: number | null;
}

export interface BreakStep {
  id: string;
  kind: "break";
  durationSec: number;
  afterExerciseId: string;
}

export type SessionStep = ExerciseStep | BreakStep;

export function isTimedStep(step: SessionStep): boolean {
  return step.kind === "break" || step.durationSec !== null;
}

export function stepDurationSec(step: SessionStep): number | null {
  return step.kind === "break" ? step.durationSec : step.durationSec;
}
