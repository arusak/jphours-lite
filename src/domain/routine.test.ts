import { describe, expect, it } from "vitest";
import { createExercise, deriveExerciseMode } from "./routine";
import { isRoutineValid, validateExercise } from "./validation";
import { createRoutine } from "./routine";

describe("exercise mode", () => {
  it("derives each supported combination", () => {
    expect(deriveExerciseMode(createExercise({ tempoBpm: 80, durationSec: 60 }))).toBe(
      "paced-timed",
    );
    expect(deriveExerciseMode(createExercise({ tempoBpm: null, durationSec: 60 }))).toBe("free-timed");
    expect(deriveExerciseMode(createExercise({ tempoBpm: null, durationSec: null }))).toBe("open-ended");
    expect(deriveExerciseMode(createExercise({ durationSec: null }))).toBe("paced-open-ended");
  });
});

describe("routine validation", () => {
  it("allows a tempo without a duration", () => {
    expect(validateExercise(createExercise({ title: "Scales", tempoBpm: 100 }))).toEqual({});
  });

  it("accepts an open-ended exercise and a zero-second break", () => {
    expect(
      isRoutineValid(
        createRoutine({
          entries: [createExercise({ title: "Explore" })],
          exercises: [createExercise({ title: "Explore" })],
          quickRestDurationSec: 0,
          defaultBreakDurationSec: 0,
        }),
      ),
    ).toBe(true);
  });
});
