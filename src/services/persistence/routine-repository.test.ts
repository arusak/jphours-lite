import { describe, expect, it } from "vitest";
import { createRoutine } from "../../domain/routine";
import { LocalStorageRoutineRepository, ROUTINE_STORAGE_KEY } from "./routine-repository";

describe("LocalStorageRoutineRepository", () => {
  it("restores the saved routine", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    const repository = new LocalStorageRoutineRepository(storage);
    const routine = createRoutine({ name: "Warm-up" });
    repository.save(routine);
    expect(repository.load()).toEqual(routine);
    expect(values.has(ROUTINE_STORAGE_KEY)).toBe(true);
  });
});
