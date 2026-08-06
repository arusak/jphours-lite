export const ROUTINE_SCHEMA_VERSION = 1 as const;

export type ExerciseMode = "paced-timed" | "free-timed" | "open-ended";

export interface Exercise {
  id: string;
  title: string;
  /** A null tempo means this exercise is not paced by the metronome. */
  tempoBpm: number | null;
  /** A null duration makes this exercise open-ended. */
  durationSec: number | null;
}

export interface Routine {
  schemaVersion: typeof ROUTINE_SCHEMA_VERSION;
  id: string;
  name: string;
  exercises: Exercise[];
  defaultBreakDurationSec: number;
  warningLeadTimeSec: number;
  autoAdvance: true;
  updatedAt: string;
}

export const DEFAULT_BREAK_DURATION_SEC = 30;
export const DEFAULT_WARNING_LEAD_TIME_SEC = 20;

const createId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `routine-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function createExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: createId(),
    title: "",
    tempoBpm: null,
    durationSec: null,
    ...overrides,
  };
}

export function createRoutine(overrides: Partial<Routine> = {}): Routine {
  return {
    schemaVersion: ROUTINE_SCHEMA_VERSION,
    id: createId(),
    name: "",
    exercises: [],
    defaultBreakDurationSec: DEFAULT_BREAK_DURATION_SEC,
    warningLeadTimeSec: DEFAULT_WARNING_LEAD_TIME_SEC,
    autoAdvance: true,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function exerciseMode(exercise: Pick<Exercise, "tempoBpm" | "durationSec">): ExerciseMode {
  if (exercise.tempoBpm !== null && exercise.durationSec !== null) return "paced-timed";
  if (exercise.durationSec !== null) return "free-timed";
  return "open-ended";
}
