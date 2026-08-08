import { createBreak, createExercise } from "../../../domain/routine";
import { EditorSheet } from "../EditorSheet/EditorSheet";
import { RoutineEntryList } from "../RoutineEntryList/RoutineEntryList";
import { RoutineSettings } from "../RoutineSettings/RoutineSettings";
import { useRoutineEditor } from "../hooks/useRoutineEditor";
import type { RoutineEditorProps } from "../types";
import styles from "../RoutineEditor.module.css";

export type { RoutineEditorProps } from "../types";
export { routineTotal } from "../routineTotal";

export function RoutineEditor({ repository, onStartSession }: RoutineEditorProps) {
  const editor = useRoutineEditor(repository);
  return (
    <section className={styles.routineEditor} aria-labelledby="routine-editor-title">
      <header className={`${styles.routineHeader} ${styles.compact}`}>
        <h1 id="routine-editor-title">{editor.routine.name.trim() || "Practice routine"}</h1>
        <button
          className={styles.routineEdit}
          aria-label="Edit routine name"
          onClick={() => editor.setSheet({ kind: "routine", name: editor.routine.name })}
        >
          ✎
        </button>
        <span
          className={styles.routineTotal}
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
      <div className={styles.entryActions}>
        <button
          className={styles.addExercise}
          onClick={() => editor.setSheet({ kind: "entry", entry: createExercise(), index: null })}
        >
          ＋ Add exercise
        </button>
        <button
          className={styles.addExercise}
          onClick={() => editor.setSheet({ kind: "entry", entry: createBreak(), index: null })}
        >
          ＋ Add break
        </button>
      </div>
      {!editor.valid && (
        <p className={styles.editorError} role="alert">
          {editor.validation.entries || "Complete each routine entry."}
        </p>
      )}
      <footer className={styles.editorFooter}>
        <button
          className={styles.primaryAction}
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
