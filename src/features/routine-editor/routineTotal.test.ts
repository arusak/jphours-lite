import { describe, expect, it } from "vitest";
import { createExercise, createRoutine } from "../../domain/routine";
import { routineTotal } from "./routineTotal";

describe("routineTotal", () => {
  it("does not add a Quick Rest after the final Exercise", () => {
    expect(
      routineTotal(
        createRoutine({ quickRestDurationSec: 30, entries: [createExercise({ durationSec: 60 })] }),
      ),
    ).toEqual({ minutes: 1, approximate: false });
  });
});
