import { createBreak, createExercise } from "../../domain/routine";
import { EditorSheet } from "./EditorSheet";
import { RoutineEntryList } from "./RoutineEntryList";
import { RoutineSettings } from "./RoutineSettings";
import { useRoutineEditor } from "./useRoutineEditor";
import type { RoutineEditorProps } from "./types";

export type { RoutineEditorProps } from "./types";
export { routineTotal } from "./routineTotal";

export function RoutineEditor({ repository, onStartSession }: RoutineEditorProps) {
  const editor = useRoutineEditor(repository);
  return (
    <section className="routine-editor" aria-labelledby="routine-editor-title">
      <header className="routine-header compact">
        <h1 id="routine-editor-title">{editor.routine.name.trim() || "Practice routine"}</h1>
        <button
          className="routine-edit"
          aria-label="Edit routine name"
          onClick={() => editor.setSheet({ kind: "routine", name: editor.routine.name })}
        >
          ✎
        </button>
        <span
          className="routine-total"
          aria-label={`${editor.total.approximate ? "approximately " : ""}${editor.total.minutes} minutes`}
        >
          {editor.total.approximate ? "≈" : ""}
          {editor.total.minutes} min
        </span>
      </header>
      <RoutineSettings
        routine={editor.routine}
        onUpdateSetting={editor.updateSetting}
        onSoundChange={(sound) =>
          editor.update((routine) => ({ ...routine, metronomeSound: sound }))
        }
      />
      <RoutineEntryList
        routine={editor.routine}
        onEdit={(index) =>
          editor.setSheet({ kind: "entry", entry: { ...editor.routine.entries[index]! }, index })
        }
        onDelete={editor.remove}
      />
      <div className="entry-actions">
        <button
          className="add-exercise"
          onClick={() => editor.setSheet({ kind: "entry", entry: createExercise(), index: null })}
        >
          ＋ Add exercise
        </button>
        <button
          className="add-exercise"
          onClick={() => editor.setSheet({ kind: "entry", entry: createBreak(), index: null })}
        >
          ＋ Add break
        </button>
      </div>
      {!editor.valid && (
        <p className="editor-error" role="alert">
          {editor.validation.entries || "Complete each routine entry."}
        </p>
      )}
      <footer className="editor-footer">
        <button
          className="primary-action"
          disabled={!editor.valid}
          onClick={() => {
            editor.flush();
            onStartSession?.(editor.routine);
          }}
        >
          ▶ Start session
        </button>
      </footer>
      {editor.sheet && (
        <EditorSheet
          sheet={editor.sheet}
          submitted={editor.submitted}
          onChange={editor.setSheet}
          onSave={editor.save}
          onCancel={editor.close}
        />
      )}
    </section>
  );
}
