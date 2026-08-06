import { useEffect, useMemo, useRef, useState } from "react";
import { createExercise, exerciseMode, type Exercise, type Routine } from "../../domain/routine";
import { isRoutineValid, validateRoutine } from "../../domain/validation";
import { DebouncedRoutineSaver } from "../../services/persistence/debounced-routine-saver";
import type { RoutineRepository } from "../../services/persistence/routine-repository";

export interface RoutineEditorProps {
  repository: RoutineRepository;
  onStartSession?: (routine: Routine) => void;
}

const MODE_LABELS = {
  "paced-timed": "Paced & timed",
  "free-timed": "Timed",
  "open-ended": "Open-ended",
} as const;

function touch(routine: Routine): Routine {
  return { ...routine, updatedAt: new Date().toISOString() };
}

function asNullableInteger(value: string): number | null {
  if (value.trim() === "") return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : Number.NaN;
}

export function RoutineEditor({ repository, onStartSession }: RoutineEditorProps) {
  const [routine, setRoutine] = useState<Routine>(() => repository.load());
  const saver = useRef(new DebouncedRoutineSaver(repository));
  const validation = useMemo(() => validateRoutine(routine), [routine]);

  useEffect(() => {
    saver.current.schedule(routine);
  }, [routine]);

  useEffect(() => {
    const routineSaver = saver.current;
    const flush = () => routineSaver.flush();
    document.addEventListener("visibilitychange", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      routineSaver.dispose();
    };
  }, []);

  const updateRoutine = (updater: (current: Routine) => Routine) =>
    setRoutine((current) => touch(updater(current)));
  const updateExercise = (id: string, updater: (current: Exercise) => Exercise) =>
    updateRoutine((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === id ? updater(exercise) : exercise,
      ),
    }));
  const moveExercise = (index: number, direction: -1 | 1) =>
    updateRoutine((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.exercises.length) return current;
      const exercises = [...current.exercises];
      [exercises[index], exercises[destination]] = [exercises[destination], exercises[index]];
      return { ...current, exercises };
    });

  return (
    <section aria-labelledby="routine-editor-title" className="routine-editor">
      <header>
        <h1 id="routine-editor-title">Practice routine</h1>
        <p>Build the exercises you want to practise, then start when every row is ready.</p>
      </header>
      <label>
        Routine name <span className="optional">(optional)</span>
        <input
          value={routine.name}
          onChange={(event) =>
            updateRoutine((current) => ({ ...current, name: event.target.value }))
          }
        />
      </label>
      <label>
        Default break (seconds)
        <input
          type="number"
          min="0"
          max="1800"
          inputMode="numeric"
          value={routine.defaultBreakDurationSec}
          onChange={(event) =>
            updateRoutine((current) => ({
              ...current,
              defaultBreakDurationSec: asNullableInteger(event.target.value) ?? Number.NaN,
            }))
          }
        />
      </label>
      {validation.defaultBreakDurationSec && (
        <p role="alert">{validation.defaultBreakDurationSec}</p>
      )}

      <div className="exercise-list" aria-label="Exercises">
        {routine.exercises.map((exercise, index) => (
          <ExerciseRow
            key={exercise.id}
            exercise={exercise}
            errors={validation.exercisesById[exercise.id]}
            canMoveUp={index > 0}
            canMoveDown={index < routine.exercises.length - 1}
            onChange={(updater) => updateExercise(exercise.id, updater)}
            onMoveUp={() => moveExercise(index, -1)}
            onMoveDown={() => moveExercise(index, 1)}
            onDelete={() =>
              updateRoutine((current) => ({
                ...current,
                exercises: current.exercises.filter(({ id }) => id !== exercise.id),
              }))
            }
          />
        ))}
      </div>
      {validation.exercises && <p role="alert">{validation.exercises}</p>}
      <button
        type="button"
        onClick={() =>
          updateRoutine((current) => ({
            ...current,
            exercises: [...current.exercises, createExercise()],
          }))
        }
      >
        Add exercise
      </button>
      <button
        type="button"
        disabled={!isRoutineValid(routine)}
        onClick={() => onStartSession?.(routine)}
      >
        Start session
      </button>
    </section>
  );
}

interface ExerciseRowProps {
  exercise: Exercise;
  errors: Record<string, string> | undefined;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (updater: (exercise: Exercise) => Exercise) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

function ExerciseRow({
  exercise,
  errors,
  canMoveUp,
  canMoveDown,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: ExerciseRowProps) {
  const id = exercise.id;
  return (
    <fieldset className="exercise-row">
      <legend>
        {exercise.title.trim() || "New exercise"} — {MODE_LABELS[exerciseMode(exercise)]}
      </legend>
      <label htmlFor={`${id}-title`}>
        Exercise name
        <input
          id={`${id}-title`}
          value={exercise.title}
          aria-invalid={Boolean(errors?.title)}
          onChange={(event) => onChange((current) => ({ ...current, title: event.target.value }))}
        />
      </label>
      {errors?.title && <p role="alert">{errors.title}</p>}
      <label htmlFor={`${id}-bpm`}>
        Tempo (BPM)
        <input
          id={`${id}-bpm`}
          type="number"
          min="20"
          max="300"
          inputMode="numeric"
          value={exercise.tempoBpm ?? ""}
          aria-invalid={Boolean(errors?.tempoBpm)}
          onChange={(event) =>
            onChange((current) => ({ ...current, tempoBpm: asNullableInteger(event.target.value) }))
          }
        />
      </label>
      {errors?.tempoBpm && <p role="alert">{errors.tempoBpm}</p>}
      <label htmlFor={`${id}-duration`}>
        Duration (seconds)
        <input
          id={`${id}-duration`}
          type="number"
          min="1"
          max="7200"
          inputMode="numeric"
          value={exercise.durationSec ?? ""}
          aria-invalid={Boolean(errors?.durationSec)}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              durationSec: asNullableInteger(event.target.value),
            }))
          }
        />
      </label>
      {errors?.durationSec && <p role="alert">{errors.durationSec}</p>}
      <div className="exercise-actions">
        <button type="button" disabled={!canMoveUp} onClick={onMoveUp}>
          Move up
        </button>
        <button type="button" disabled={!canMoveDown} onClick={onMoveDown}>
          Move down
        </button>
        <button type="button" onClick={onDelete}>
          Delete
        </button>
      </div>
    </fieldset>
  );
}
