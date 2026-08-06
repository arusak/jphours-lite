import { useEffect, useMemo, useRef, useState } from "react";
import { BottomSheet } from "../../components";
import { createExercise, exerciseMode, type Exercise, type Routine } from "../../domain/routine";
import { isRoutineValid, validateExercise, validateRoutine } from "../../domain/validation";
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
  "paced-open-ended": "Paced open-ended",
} as const;

const integerOrNull = (value: string) => (value.trim() === "" ? null : Number(value));
const touch = (routine: Routine): Routine => ({ ...routine, updatedAt: new Date().toISOString() });
const formatDuration = (seconds: number) =>
  seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

type SheetState =
  | { kind: "routine"; value: string }
  | { kind: "exercise"; value: Exercise; index: number | null }
  | null;
type Deleted = { exercise: Exercise; index: number };

export function RoutineEditor({ repository, onStartSession }: RoutineEditorProps) {
  const [routine, setRoutine] = useState<Routine>(() => repository.load());
  const [sheet, setSheet] = useState<SheetState>(null);
  const [submitted, setSubmitted] = useState(false);
  const [deleted, setDeleted] = useState<Deleted | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragTarget, setDragTarget] = useState<number | null>(null);
  const saver = useRef(new DebouncedRoutineSaver(repository));
  const validation = useMemo(() => validateRoutine(routine), [routine]);

  useEffect(() => saver.current.schedule(routine), [routine]);
  useEffect(() => {
    const current = saver.current;
    const flush = () => current.flush();
    document.addEventListener("visibilitychange", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      current.dispose();
    };
  }, []);
  useEffect(() => {
    if (!deleted) return;
    const timeout = window.setTimeout(() => setDeleted(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [deleted]);

  const update = (fn: (current: Routine) => Routine) => setRoutine((current) => touch(fn(current)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= routine.exercises.length || from === to) return;
    update((current) => {
      const exercises = [...current.exercises];
      const [item] = exercises.splice(from, 1);
      exercises.splice(to, 0, item);
      return { ...current, exercises };
    });
    setAnnouncement(`${routine.exercises[from].title} moved to position ${to + 1}.`);
  };
  const closeSheet = () => {
    setSheet(null);
    setSubmitted(false);
  };
  const saveSheet = () => {
    if (!sheet) return;
    if (sheet.kind === "routine") {
      update((current) => ({ ...current, name: sheet.value.trim() }));
      closeSheet();
      return;
    }
    const errors = validateExercise(sheet.value);
    if (Object.keys(errors).length) {
      setSubmitted(true);
      return;
    }
    update((current) => ({
      ...current,
      exercises:
        sheet.index === null
          ? [...current.exercises, sheet.value]
          : current.exercises.map((item, index) => (index === sheet.index ? sheet.value : item)),
    }));
    closeSheet();
  };

  return (
    <section aria-labelledby="routine-editor-title" className="routine-editor">
      <header className="routine-header">
        <div>
          <p className="eyebrow">Routine</p>
          <h1 id="routine-editor-title">{routine.name.trim() || "Practice routine"}</h1>
        </div>
        <button
          className="routine-edit"
          type="button"
          onClick={() => setSheet({ kind: "routine", value: routine.name })}
        >
          ✎ Edit
        </button>
      </header>

      <div className="break-row">
        <span>
          ◷ <strong>Small breaks</strong>
        </span>
        <div className="break-stepper">
          <button
            aria-label="Decrease break"
            onClick={() =>
              update((current) => ({
                ...current,
                defaultBreakDurationSec: Math.max(0, current.defaultBreakDurationSec - 5),
              }))
            }
          >
            −
          </button>
          <span>{routine.defaultBreakDurationSec}s</span>
          <button
            aria-label="Increase break"
            onClick={() =>
              update((current) => ({
                ...current,
                defaultBreakDurationSec: Math.min(1800, current.defaultBreakDurationSec + 5),
              }))
            }
          >
            +
          </button>
        </div>
      </div>
      {validation.defaultBreakDurationSec && (
        <p role="alert">{validation.defaultBreakDurationSec}</p>
      )}

      <div className="exercise-heading">
        <h2>Exercises</h2>
        <span>{routine.exercises.length}</span>
      </div>
      <div className="exercise-list" aria-label="Exercises">
        {routine.exercises.map((exercise, index) => (
          <article
            key={exercise.id}
            data-exercise-index={index}
            className={`exercise-card${dragIndex === index ? " is-dragging" : ""}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) move(dragIndex, index);
              setDragIndex(null);
            }}
          >
            <button
              className="drag-handle"
              type="button"
              draggable
              aria-label={`Reorder ${exercise.title}`}
              onDragStart={() => {
                setDragIndex(index);
                setDragTarget(index);
                setAnnouncement(`${exercise.title} lifted.`);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setDragTarget(null);
                setAnnouncement(`${exercise.title} dropped.`);
              }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture?.(event.pointerId);
                setDragIndex(index);
                setDragTarget(index);
                setAnnouncement(`${exercise.title} lifted.`);
              }}
              onPointerMove={(event) => {
                if (dragIndex === null) return;
                const card = document
                  .elementFromPoint?.(event.clientX, event.clientY)
                  ?.closest<HTMLElement>("[data-exercise-index]");
                const target = Number(card?.dataset.exerciseIndex);
                if (Number.isInteger(target) && target !== dragTarget) {
                  setDragTarget(target);
                  setAnnouncement(`${exercise.title} over position ${target + 1}.`);
                }
                if (event.clientY < 72) window.scrollBy({ top: -20, behavior: "auto" });
                else if (event.clientY > window.innerHeight - 72)
                  window.scrollBy({ top: 20, behavior: "auto" });
              }}
              onPointerUp={() => {
                if (dragIndex !== null && dragTarget !== null) move(dragIndex, dragTarget);
                setDragIndex(null);
                setDragTarget(null);
                setAnnouncement(`${exercise.title} dropped.`);
              }}
              onPointerCancel={() => {
                setDragIndex(null);
                setDragTarget(null);
                setAnnouncement(`${exercise.title} reorder cancelled.`);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp") move(index, index - 1);
                if (event.key === "ArrowDown") move(index, index + 1);
              }}
            >
              ⠿
            </button>
            <div className="exercise-card-content">
              <div className="exercise-title-row">
                <span>{index + 1}</span>
                <h3 data-testid="exercise-title">{exercise.title}</h3>
              </div>
              <div className="exercise-meta">
                {exercise.tempoBpm !== null && (
                  <span className="badge tempo">♪ {exercise.tempoBpm} BPM</span>
                )}
                {exercise.durationSec !== null && (
                  <span className="badge">◷ {formatDuration(exercise.durationSec)}</span>
                )}
                {exercise.durationSec === null && (
                  <span className="badge open">{MODE_LABELS[exerciseMode(exercise)]}</span>
                )}
              </div>
            </div>
            <button
              className="card-action"
              aria-label={`Edit ${exercise.title}`}
              onClick={() => setSheet({ kind: "exercise", value: { ...exercise }, index })}
            >
              ✎
            </button>
            <button
              className="card-action delete"
              aria-label={`Delete ${exercise.title}`}
              onClick={() => {
                setDeleted({ exercise, index });
                update((current) => ({
                  ...current,
                  exercises: current.exercises.filter((item) => item.id !== exercise.id),
                }));
              }}
            >
              ×
            </button>
          </article>
        ))}
      </div>
      {validation.exercises && (
        <p className="editor-error" role="alert">
          {validation.exercises}
        </p>
      )}
      <button
        className="add-exercise"
        type="button"
        onClick={() => setSheet({ kind: "exercise", value: createExercise(), index: null })}
      >
        ＋ Add exercise
      </button>

      <footer className="editor-footer">
        <button
          className="primary-action"
          type="button"
          disabled={!isRoutineValid(routine)}
          onClick={() => {
            saver.current.flush();
            onStartSession?.(routine);
          }}
        >
          ▶ Start session
        </button>
      </footer>
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      {deleted && (
        <div className="undo-toast" role="status">
          <span>{deleted.exercise.title} deleted</span>
          <button
            onClick={() => {
              const item = deleted;
              update((current) => {
                const exercises = [...current.exercises];
                exercises.splice(item.index, 0, item.exercise);
                return { ...current, exercises };
              });
              setDeleted(null);
            }}
          >
            Undo
          </button>
        </div>
      )}
      {sheet && (
        <EditorSheet
          sheet={sheet}
          submitted={submitted}
          onChange={setSheet}
          onSave={saveSheet}
          onCancel={closeSheet}
        />
      )}
    </section>
  );
}

function EditorSheet({
  sheet,
  submitted,
  onChange,
  onSave,
  onCancel,
}: {
  sheet: Exclude<SheetState, null>;
  submitted: boolean;
  onChange(value: Exclude<SheetState, null>): void;
  onSave(): void;
  onCancel(): void;
}) {
  const errors = sheet.kind === "exercise" && submitted ? validateExercise(sheet.value) : {};
  const title =
    sheet.kind === "routine"
      ? "Edit routine"
      : sheet.index === null
        ? "Add exercise"
        : "Edit exercise";
  return (
    <BottomSheet title={title} onClose={onCancel}>
      {sheet.kind === "routine" ? (
        <label>
          Routine name
          <input
            value={sheet.value}
            onChange={(event) => onChange({ ...sheet, value: event.target.value })}
          />
        </label>
      ) : (
        <>
          <label>
            Exercise name
            <input
              value={sheet.value.title}
              aria-invalid={Boolean(errors.title)}
              onChange={(event) =>
                onChange({ ...sheet, value: { ...sheet.value, title: event.target.value } })
              }
            />
          </label>
          {errors.title && <p role="alert">{errors.title}</p>}
          <label>
            Tempo (BPM) <span className="optional">optional</span>
            <input
              type="number"
              min="20"
              max="300"
              inputMode="numeric"
              value={sheet.value.tempoBpm ?? ""}
              aria-invalid={Boolean(errors.tempoBpm)}
              onChange={(event) =>
                onChange({
                  ...sheet,
                  value: { ...sheet.value, tempoBpm: integerOrNull(event.target.value) },
                })
              }
            />
          </label>
          {errors.tempoBpm && <p role="alert">{errors.tempoBpm}</p>}
          <label>
            Duration (seconds) <span className="optional">optional</span>
            <input
              type="number"
              min="1"
              max="7200"
              inputMode="numeric"
              value={sheet.value.durationSec ?? ""}
              aria-invalid={Boolean(errors.durationSec)}
              onChange={(event) =>
                onChange({
                  ...sheet,
                  value: { ...sheet.value, durationSec: integerOrNull(event.target.value) },
                })
              }
            />
          </label>
          {errors.durationSec && <p role="alert">{errors.durationSec}</p>}
        </>
      )}
      <div className="sheet-actions">
        <button className="primary-action" onClick={onSave}>
          Save
        </button>
        <button className="secondary-action" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </BottomSheet>
  );
}
