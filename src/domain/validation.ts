import { practiceConfig } from "../config/practice-config";
import type { Break, Exercise, Routine, RoutineEntry } from "./routine";

export const TITLE_MIN_LENGTH = 1;
export const TITLE_MAX_LENGTH = 200;
export const MIN_TEMPO_BPM = practiceConfig.tempo.min;
export const MAX_TEMPO_BPM = practiceConfig.tempo.max;
export const MIN_DURATION_SEC = practiceConfig.exerciseDuration.min;
export const MAX_DURATION_SEC = practiceConfig.exerciseDuration.max;

export type FieldErrors<T extends string> = Partial<Record<T, string>>;
export type EntryErrors = FieldErrors<"title" | "tempoBpm" | "durationSec">;

export function validateExercise(exercise: Exercise): EntryErrors {
  const errors: EntryErrors = {};
  const titleLength = exercise.title.trim().length;
  if (titleLength < TITLE_MIN_LENGTH) errors.title = "Enter an exercise name.";
  else if (titleLength > TITLE_MAX_LENGTH) errors.title = "Use at most 200 characters.";
  if (exercise.tempoBpm !== null && (!Number.isInteger(exercise.tempoBpm) || exercise.tempoBpm < MIN_TEMPO_BPM || exercise.tempoBpm > MAX_TEMPO_BPM)) errors.tempoBpm = `Use a tempo from ${MIN_TEMPO_BPM} to ${MAX_TEMPO_BPM} BPM.`;
  if (exercise.durationSec !== null && (!Number.isInteger(exercise.durationSec) || exercise.durationSec < MIN_DURATION_SEC || exercise.durationSec > MAX_DURATION_SEC)) errors.durationSec = "Enter a duration in the configured range.";
  return errors;
}

export function validateBreak(entry: Break): EntryErrors {
  const errors: EntryErrors = {};
  if (!Number.isInteger(entry.durationSec) || entry.durationSec < practiceConfig.breakDuration.min || entry.durationSec > practiceConfig.breakDuration.max) errors.durationSec = "Enter a break duration in the configured range.";
  return errors;
}

export function validateEntry(entry: RoutineEntry): EntryErrors {
  return entry.kind === "exercise" ? validateExercise(entry) : validateBreak(entry);
}

export function validateRoutine(routine: Routine): FieldErrors<"entries" | "exercises" | "quickRestDurationSec" | "defaultBreakDurationSec" | "warningLeadTimeSec" | "metronomeSound"> & { entriesById: Record<string, EntryErrors> } {
  const errors: FieldErrors<"entries" | "exercises" | "quickRestDurationSec" | "defaultBreakDurationSec" | "warningLeadTimeSec" | "metronomeSound"> & { entriesById: Record<string, EntryErrors> } = { entriesById: Object.fromEntries(routine.entries.map((entry) => [entry.id, validateEntry(entry)])) };
  if (routine.entries.length === 0) errors.entries = "Add at least one routine entry.";
  if (routine.exercises.length === 0) errors.exercises = "Add at least one exercise.";
  if (!inPolicy(routine.quickRestDurationSec, practiceConfig.quickRestDuration)) errors.quickRestDurationSec = "Use a Quick Rest duration in the configured range.";
  if (!inPolicy(routine.defaultBreakDurationSec, practiceConfig.quickRestDuration)) errors.defaultBreakDurationSec = "Use a Quick Rest duration in the configured range.";
  if (!inPolicy(routine.warningLeadTimeSec, practiceConfig.warningLeadTime)) errors.warningLeadTimeSec = "Use a Warning lead time in the configured range.";
  if (!(routine.metronomeSound in practiceConfig.metronome.sounds)) errors.metronomeSound = "Choose a Metronome sound.";
  return errors;
}

function inPolicy(value: number, policy: { min: number; max: number; increment: number }): boolean {
  return Number.isInteger(value) && value >= policy.min && value <= policy.max && (value - policy.min) % policy.increment === 0;
}

export function isRoutineValid(routine: Routine): boolean {
  const validation = validateRoutine(routine);
  return !validation.entries && !validation.exercises && !validation.quickRestDurationSec && !validation.defaultBreakDurationSec && !validation.warningLeadTimeSec && !validation.metronomeSound && Object.values(validation.entriesById).every((errors) => Object.keys(errors).length === 0);
}
