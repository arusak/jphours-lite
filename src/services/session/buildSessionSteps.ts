import { deriveExerciseMode, type Routine } from "../../domain/routine";
import type { ExerciseStep, SessionPlan, SessionStep } from "../../domain/session";

/**
 * Builds the immutable execution snapshot used by a running session.  It never
 * retains references to the routine's exercise objects.
 */
export function buildSessionSteps(routine: Routine): SessionStep[] {
  return buildSessionPlan(routine).steps;
}

/**
 * Captures the routine's ordered entries at session start. Quick Rests stay
 * outside `steps`: they are transition metadata after directly adjacent
 * exercises, so progress and Now Playing only contain meaningful entries.
 */
export function buildSessionPlan(routine: Routine): SessionPlan {
  if (routine.entries.length === 0) throw new Error("A routine needs at least one entry to start a session.");

  assertRoutineSettings(routine);

  const steps: SessionStep[] = [];
  const quickRests: SessionPlan["quickRests"] = [];
  routine.entries.forEach((entry, index) => {
    if (entry.kind === "break") {
      assertBreak(entry);
      steps.push({
        id: `break:${entry.id}`,
        kind: "break",
        sourceBreakId: entry.id,
        title: "Break",
        durationSec: entry.durationSec,
      });
      return;
    }
    assertExercise(entry);
    const step: ExerciseStep = {
      id: `exercise:${entry.id}`,
      kind: "exercise",
      sourceExerciseId: entry.id,
      title: entry.title.trim(),
      mode: deriveExerciseMode(entry),
      tempoBpm: entry.tempoBpm,
      durationSec: entry.durationSec,
    };
    steps.push(step);
    const next = routine.entries[index + 1];
    if (next?.kind === "exercise" && routine.quickRestDurationSec > 0) {
      quickRests.push({ id: `quick-rest:${entry.id}`, afterStepId: step.id, durationSec: routine.quickRestDurationSec });
    }
  });
  return { steps, quickRests };
}

function assertRoutineSettings(routine: Routine): void {
  if (
    !Number.isFinite(routine.quickRestDurationSec) ||
    routine.quickRestDurationSec < 0 ||
    routine.quickRestDurationSec > 180
  ) {
    throw new Error("Quick Rest duration must be between 0 and 180 seconds.");
  }
}

function assertExercise(exercise: Extract<Routine["entries"][number], { kind: "exercise" }>): void {
  const title = exercise.title.trim();
  if (title.length < 1 || title.length > 200) {
    throw new Error("Exercise title must contain 1 to 200 characters.");
  }
  if (
    exercise.tempoBpm !== null &&
    (!Number.isFinite(exercise.tempoBpm) || exercise.tempoBpm < 20 || exercise.tempoBpm > 300)
  ) {
    throw new Error("Tempo must be between 20 and 300 BPM.");
  }
  if (
    exercise.durationSec !== null &&
    (!Number.isFinite(exercise.durationSec) ||
      exercise.durationSec < 1 ||
      exercise.durationSec > 120 * 60)
  ) {
    throw new Error("Timed exercise duration must be between 1 and 7200 seconds.");
  }
}

function assertBreak(entry: Extract<Routine["entries"][number], { kind: "break" }>): void {
  if (!Number.isFinite(entry.durationSec) || entry.durationSec < 1 || entry.durationSec > 20 * 60) {
    throw new Error("Break duration must be between 1 and 1200 seconds.");
  }
}
