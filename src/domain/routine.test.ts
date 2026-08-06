import { describe, expect, it } from "vitest";
import { createExercise, deriveExerciseMode } from "./routine";
import { isRoutineValid, validateExercise } from "./validation";
import { createRoutine } from "./routine";

describe("exercise mode", () => {
  it("derives each supported combination", () => {
    expect(deriveExerciseMode(createExercise({ tempoBpm: 80, durationSec: 60 }))).toBe(
      "paced-timed",
    );
    expect(deriveExerciseMode(createExercise({ durationSec: 60 }))).toBe("free-timed");
    expect(deriveExerciseMode(createExercise())).toBe("open-ended");
    expect(deriveExerciseMode(createExercise({ tempoBpm: 80 }))).toBe("paced-open-ended");
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
          defaultBreakDurationSec: 0,
          exercises: [createExercise({ title: "Explore" })],
        }),
      ),
    ).toBe(true);
  });
});
