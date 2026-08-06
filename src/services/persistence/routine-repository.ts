import { createRoutine, ROUTINE_SCHEMA_VERSION, type Routine } from "../../domain/routine";

export const ROUTINE_STORAGE_KEY = "rhythm-practice-trainer/routine";

export interface RoutineRepository {
  load(): Routine;
  save(routine: Routine): void;
}

/** The only place persisted schema compatibility is decided. Add older versions here. */
export function migrateRoutine(value: unknown): Routine {
  if (!isRoutineLike(value)) return createRoutine();
  if (value.schemaVersion === ROUTINE_SCHEMA_VERSION) return value;
  return createRoutine();
}

export class LocalStorageRoutineRepository implements RoutineRepository {
  constructor(private readonly storage: Pick<Storage, "getItem" | "setItem"> = window.localStorage) {}

  load(): Routine {
    try {
      const saved = this.storage.getItem(ROUTINE_STORAGE_KEY);
      return saved === null ? createRoutine() : migrateRoutine(JSON.parse(saved));
    } catch {
      return createRoutine();
    }
  }

  save(routine: Routine): void {
    this.storage.setItem(ROUTINE_STORAGE_KEY, JSON.stringify(routine));
  }
}

function isRoutineLike(value: unknown): value is Routine {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Routine>;
  return candidate.schemaVersion === ROUTINE_SCHEMA_VERSION && typeof candidate.id === "string" && typeof candidate.name === "string" && Array.isArray(candidate.exercises) && typeof candidate.defaultBreakDurationSec === "number" && typeof candidate.warningLeadTimeSec === "number" && candidate.autoAdvance === true && typeof candidate.updatedAt === "string";
}
