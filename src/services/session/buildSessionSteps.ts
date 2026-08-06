import type { Routine } from "../../domain/routine";
import { deriveExerciseMode, type ExerciseStep, type SessionStep } from "../../domain/session";

/**
 * Builds the immutable execution snapshot used by a running session.  It never
 * retains references to the routine's exercise objects.
 */
export function buildSessionSteps(routine: Routine): SessionStep[] {
  if (routine.exercises.length === 0) {
    throw new Error("A routine needs at least one exercise to start a session.");
  }

  assertRoutineSettings(routine);

  const steps: SessionStep[] = [];
  const lastExerciseIndex = routine.exercises.length - 1;

  routine.exercises.forEach((exercise, index) => {
    assertExercise(exercise);
    const exerciseStep: ExerciseStep = {
      id: `exercise:${exercise.id}`,
      kind: "exercise",
      sourceExerciseId: exercise.id,
      title: exercise.title.trim(),
      mode: deriveExerciseMode(exercise),
      tempoBpm: exercise.tempoBpm,
      durationSec: exercise.durationSec,
    };
    steps.push(exerciseStep);

    if (index !== lastExerciseIndex && routine.defaultBreakDurationSec > 0) {
      steps.push({
        id: `break:${exercise.id}`,
        kind: "break",
        durationSec: routine.defaultBreakDurationSec,
        afterExerciseId: exercise.id,
      });
    }
  });

  return steps;
}

function assertRoutineSettings(routine: Routine): void {
  if (
    !Number.isFinite(routine.defaultBreakDurationSec) ||
    routine.defaultBreakDurationSec < 0 ||
    routine.defaultBreakDurationSec > 30 * 60
  ) {
    throw new Error("Break duration must be between 0 and 1800 seconds.");
  }
}

function assertExercise(exercise: Routine["exercises"][number]): void {
  const title = exercise.title.trim();
  if (title.length < 1 || title.length > 200) {
    throw new Error("Exercise title must contain 1 to 200 characters.");
  }
  if (
    exercise.tempoBpm !== null &&
    (!Number.isFinite(exercise.tempoBpm) || exercise.tempoBpm < 20 || exercise.tempoBpm > 300)
  ) {
    throw new Error("Tempo must be between 20 and 300 BPM.");
  }
  if (
    exercise.durationSec !== null &&
    (!Number.isFinite(exercise.durationSec) ||
      exercise.durationSec < 1 ||
      exercise.durationSec > 120 * 60)
  ) {
    throw new Error("Timed exercise duration must be between 1 and 7200 seconds.");
  }
  // This also deliberately rejects a tempo without a duration.
  deriveExerciseMode(exercise);
}
