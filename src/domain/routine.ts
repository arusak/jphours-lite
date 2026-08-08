import { practiceConfig, type MetronomeSound } from "../config/practice-config";

export const ROUTINE_SCHEMA_VERSION = 2 as const;

export type ExerciseMode = "paced-timed" | "free-timed" | "paced-open-ended" | "open-ended";

export interface Exercise {
  id: string;
  kind: "exercise";
  title: string;
  tempoBpm: number | null;
  durationSec: number | null;
}

export interface Break {
  id: string;
  kind: "break";
  durationSec: number;
}

export type RoutineEntry = Exercise | Break;

export interface Routine {
  schemaVersion: typeof ROUTINE_SCHEMA_VERSION;
  id: string;
  name: string;
  entries: RoutineEntry[];
  quickRestDurationSec: number;
  warningLeadTimeSec: number;
  metronomeSound: MetronomeSound;
  autoAdvance: true;
  updatedAt: string;
}

const createId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `routine-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function createExercise(overrides: Partial<Omit<Exercise, "kind">> = {}): Exercise {
  return {
    id: createId(),
    kind: "exercise",
    title: "Exercise",
    tempoBpm: practiceConfig.tempo.default,
    durationSec: practiceConfig.exerciseDuration.default,
    ...overrides,
  };
}

export function createBreak(overrides: Partial<Omit<Break, "kind">> = {}): Break {
  return { id: createId(), kind: "break", durationSec: practiceConfig.breakDuration.default, ...overrides };
}

export function createRoutine(overrides: Partial<Routine> = {}): Routine {
  const defaultExercise = createExercise();
  return {
    schemaVersion: ROUTINE_SCHEMA_VERSION,
    id: createId(),
    name: "",
    entries: [defaultExercise],
    quickRestDurationSec: practiceConfig.quickRestDuration.default,
    warningLeadTimeSec: practiceConfig.warningLeadTime.default,
    metronomeSound: practiceConfig.metronome.defaultSound,
    autoAdvance: true,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function deriveExerciseMode(exercise: Pick<Exercise, "tempoBpm" | "durationSec">): ExerciseMode {
  if (exercise.tempoBpm !== null && exercise.durationSec !== null) return "paced-timed";
  if (exercise.tempoBpm === null && exercise.durationSec !== null) return "free-timed";
  if (exercise.tempoBpm !== null) return "paced-open-ended";
  return "open-ended";
}

export const exerciseMode = deriveExerciseMode;
