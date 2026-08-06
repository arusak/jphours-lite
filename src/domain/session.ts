import type { Exercise } from "./routine";

export type ExerciseMode = "paced-timed" | "free-timed" | "open-ended";

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

/** Derives the only three executable exercise modes supported by the prototype. */
export function deriveExerciseMode(exercise: Pick<Exercise, "tempoBpm" | "durationSec">): ExerciseMode {
  if (exercise.tempoBpm !== null && exercise.durationSec !== null) {
    return "paced-timed";
  }

  if (exercise.tempoBpm === null && exercise.durationSec !== null) {
    return "free-timed";
  }

  if (exercise.tempoBpm === null && exercise.durationSec === null) {
    return "open-ended";
  }

  throw new Error("An exercise with a tempo must have a duration.");
}

export function isTimedStep(step: SessionStep): boolean {
  return step.kind === "break" || step.mode !== "open-ended";
}

export function stepDurationSec(step: SessionStep): number | null {
  return step.kind === "break" ? step.durationSec : step.durationSec;
}
