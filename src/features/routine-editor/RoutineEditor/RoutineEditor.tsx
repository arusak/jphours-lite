import { createBreak, createExercise } from '../../../domain/routine'
import { AppUpdateBanner, PlayIcon } from '../../../components'
import { EditorSheet } from '../EditorSheet/EditorSheet'
import { RoutineFileActions } from '../RoutineFileActions/RoutineFileActions'
import { RoutineEntryList } from '../RoutineEntryList/RoutineEntryList'
import { RoutineSettings } from '../RoutineSettings/RoutineSettings'
import { useRoutineEditor } from '../hooks/useRoutineEditor'
import type { RoutineEditorProps } from '../types'
import styles from '../RoutineEditor.module.css'

export type { RoutineEditorProps } from '../types'
export { routineTotal } from '../routineTotal'

const validationErrorId = 'routine-validation-error'

export function RoutineEditor({ repository, onStartSession }: RoutineEditorProps) {
  const editor = useRoutineEditor(repository)
  return (
    <section className={styles.routineEditor} aria-labelledby="routine-editor-title">
      <AppUpdateBanner onBeforeUpdate={editor.flush} />
      <header className={styles.routineHeader}>
        <h1 id="routine-editor-title">{editor.routine.name.trim() || 'Practice routine'}</h1>
        <button
          className={styles.routineEdit}
          aria-label="Edit routine name"
          onClick={() => editor.setSheet({ kind: 'routine', name: editor.routine.name })}
        >
          ✎
        </button>
      </header>
      <div className={styles.subMenu}>
        <span
          className={styles.routineTotal}
          aria-label={`${editor.total.approximate ? 'approximately ' : ''}${editor.total.minutes} minutes`}
        >
          {editor.total.approximate ? '≈' : ''}
          {editor.total.minutes} min
        </span>
        <RoutineFileActions
          routine={editor.routine}
          exportDisabled={!editor.valid}
          exportErrorId={validationErrorId}
          onImport={editor.replaceRoutine}
        />
      </div>
      <RoutineSettings
        routine={editor.routine}
        onUpdateSetting={editor.updateSetting}
        onSoundChange={(sound) =>
          editor.update((routine) => ({ ...routine, metronomeSound: sound }))
        }
        onAlternateBeatToneChange={(alternateBeatTone) =>
          editor.update((routine) => ({ ...routine, alternateBeatTone }))
        }
      />
      <RoutineEntryList
        routine={editor.routine}
        onEdit={(index) =>
          editor.setSheet({ kind: 'entry', entry: { ...editor.routine.entries[index]! }, index })
        }
        onDelete={editor.remove}
        onReorder={editor.reorder}
      />
      <div className={styles.entryActions}>
        <button
          className={styles.addExercise}
          disabled={editor.atEntryLimit}
          aria-describedby={editor.atEntryLimit ? 'routine-entry-limit' : undefined}
          onClick={() => editor.setSheet({ kind: 'entry', entry: createExercise(), index: null })}
        >
          ＋ Add exercise
        </button>
        <button
          className={styles.addExercise}
          disabled={editor.atEntryLimit}
          aria-describedby={editor.atEntryLimit ? 'routine-entry-limit' : undefined}
          onClick={() => editor.setSheet({ kind: 'entry', entry: createBreak(), index: null })}
        >
          ＋ Add break
        </button>
      </div>
      {editor.atEntryLimit && (
        <p id="routine-entry-limit" className={styles.editorError}>
          This Routine has reached the limit of 1,000 entries.
        </p>
      )}
      {!editor.valid && (
        <p id={validationErrorId} className={styles.editorError} role="alert">
          {editor.validation.form ||
            editor.validation.entries ||
            editor.validation.quickRestDurationSec ||
            editor.validation.warningLeadTimeSec ||
            editor.validation.metronomeSound ||
            editor.validation.alternateBeatTone ||
            'Complete each routine entry.'}
        </p>
      )}
      <footer className={styles.editorFooter}>
        <button
          className={styles.primaryAction}
          disabled={!editor.valid}
          aria-describedby={!editor.valid ? validationErrorId : undefined}
          onClick={() => {
            editor.flush()
            onStartSession?.(editor.routine)
          }}
        >
          <PlayIcon className={styles.buttonIcon} />
          Start session
        </button>
      </footer>
      <EditorSheet
        sheet={editor.sheet}
        submitted={editor.submitted}
        onChange={editor.setSheet}
        onSave={editor.save}
        onCancel={editor.close}
      />
    </section>
  )
}
