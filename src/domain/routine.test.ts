import { describe, expect, it } from "vitest";
import { createExercise, exerciseMode } from "./routine";
import { isRoutineValid, validateExercise } from "./validation";
import { createRoutine } from "./routine";

describe("exercise mode", () => {
  it("derives each supported combination", () => {
    expect(exerciseMode(createExercise({ tempoBpm: 80, durationSec: 60 }))).toBe("paced-timed");
    expect(exerciseMode(createExercise({ durationSec: 60 }))).toBe("free-timed");
    expect(exerciseMode(createExercise())).toBe("open-ended");
  });
});

describe("routine validation", () => {
  it("does not allow a tempo without a duration", () => {
    expect(validateExercise(createExercise({ title: "Scales", tempoBpm: 100 })).durationSec).toBe(
      "A metronome exercise needs a duration.",
    );
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
