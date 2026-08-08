import { describe, expect, it } from "vitest";
import { createBreak, createExercise, createRoutine, deriveExerciseMode } from "./routine";
import { isRoutineValid, validateExercise } from "./validation";

describe("exercise mode", () => {
  it("derives each supported combination", () => {
    expect(deriveExerciseMode(createExercise({ tempoBpm: 80, durationSec: 60 }))).toBe(
      "paced-timed",
    );
    expect(deriveExerciseMode(createExercise({ tempoBpm: null, durationSec: 60 }))).toBe(
      "free-timed",
    );
    expect(deriveExerciseMode(createExercise({ tempoBpm: null, durationSec: null }))).toBe(
      "open-ended",
    );
    expect(deriveExerciseMode(createExercise({ durationSec: null }))).toBe("paced-open-ended");
  });
});

describe("routine validation", () => {
  it("allows a tempo without a duration", () => {
    expect(validateExercise(createExercise({ title: "Scales", tempoBpm: 100 }))).toEqual({});
  });

  it("accepts an open-ended exercise and a zero-second Quick Rest", () => {
    expect(
      isRoutineValid(
        createRoutine({
          entries: [createExercise({ title: "Explore" })],
          quickRestDurationSec: 0,
        }),
      ),
    ).toBe(true);
  });

  it("accepts a Break-only Routine and rejects fractional-minute durations", () => {
    expect(isRoutineValid(createRoutine({ entries: [createBreak({ durationSec: 120 })] }))).toBe(
      true,
    );
    expect(validateExercise(createExercise({ durationSec: 90 })).durationSec).toBeDefined();
  });
});
