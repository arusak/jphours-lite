import type { Exercise, Routine } from "./routine";

export const TITLE_MIN_LENGTH = 1;
export const TITLE_MAX_LENGTH = 200;
export const MIN_TEMPO_BPM = 20;
export const MAX_TEMPO_BPM = 300;
export const MIN_DURATION_SEC = 1;
export const MAX_DURATION_SEC = 120 * 60;
export const MIN_BREAK_DURATION_SEC = 0;
export const MAX_BREAK_DURATION_SEC = 30 * 60;

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

export function validateExercise(exercise: Exercise): FieldErrors<"title" | "tempoBpm" | "durationSec"> {
  const errors: FieldErrors<"title" | "tempoBpm" | "durationSec"> = {};
  const titleLength = exercise.title.trim().length;

  if (titleLength < TITLE_MIN_LENGTH) errors.title = "Enter an exercise name.";
  else if (titleLength > TITLE_MAX_LENGTH) errors.title = "Use at most 200 characters.";

  if (exercise.tempoBpm !== null && (!Number.isInteger(exercise.tempoBpm) || exercise.tempoBpm < MIN_TEMPO_BPM || exercise.tempoBpm > MAX_TEMPO_BPM)) {
    errors.tempoBpm = "Use a tempo from 20 to 300 BPM.";
  }
  if (exercise.durationSec !== null && (!Number.isInteger(exercise.durationSec) || exercise.durationSec < MIN_DURATION_SEC || exercise.durationSec > MAX_DURATION_SEC)) {
    errors.durationSec = "Enter a duration from 1 second to 120 minutes.";
  }
  if (exercise.tempoBpm !== null && exercise.durationSec === null) {
    errors.durationSec = "A metronome exercise needs a duration.";
  }
  return errors;
}

export function validateRoutine(routine: Routine): FieldErrors<"exercises" | "defaultBreakDurationSec"> & { exercisesById: Record<string, ReturnType<typeof validateExercise>> } {
  const exercisesById = Object.fromEntries(routine.exercises.map((exercise) => [exercise.id, validateExercise(exercise)]));
  const errors: FieldErrors<"exercises" | "defaultBreakDurationSec"> & { exercisesById: Record<string, ReturnType<typeof validateExercise>> } = { exercisesById };
  if (routine.exercises.length === 0) errors.exercises = "Add at least one exercise.";
  if (!Number.isInteger(routine.defaultBreakDurationSec) || routine.defaultBreakDurationSec < MIN_BREAK_DURATION_SEC || routine.defaultBreakDurationSec > MAX_BREAK_DURATION_SEC) {
    errors.defaultBreakDurationSec = "Use a break from 0 seconds to 30 minutes.";
  }
  return errors;
}

export function isRoutineValid(routine: Routine): boolean {
  const validation = validateRoutine(routine);
  return !validation.exercises && !validation.defaultBreakDurationSec && Object.values(validation.exercisesById).every((errors) => Object.keys(errors).length === 0);
}
