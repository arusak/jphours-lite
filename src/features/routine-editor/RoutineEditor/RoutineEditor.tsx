import { createBreak, createExercise } from '../../../domain/routine'
import { AppUpdateBanner, PlayIcon } from '../../../components'
import { EditorSheet } from '../EditorSheet/EditorSheet'
import { RoutinePicker } from '../RoutinePicker/RoutinePicker'
import { RoutineFileActions } from '../RoutineFileActions/RoutineFileActions'
import { RoutineEntryList } from '../RoutineEntryList/RoutineEntryList'
import { RoutineSettings } from '../RoutineSettings/RoutineSettings'
import { useRoutineEditor } from '../hooks/useRoutineEditor'
import type { RoutineEditorProps } from '../types'
import sharedStyles from '../shared.module.css'
import styles from './RoutineEditor.module.css'

export type { RoutineEditorProps } from '../types'
export { routineTotal } from '../routineTotal'

const validationErrorId = 'routine-validation-error'

export function RoutineEditor({ repository, onStartSession }: RoutineEditorProps) {
  const editor = useRoutineEditor(repository)
  return (
    <section className={styles.routineEditor} aria-labelledby="routine-editor-title">
      <AppUpdateBanner onBeforeUpdate={editor.flush} />
      <div className={styles.headerWrapper}>
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
          <RoutinePicker
            routines={editor.routines}
            selectedRoutineId={editor.routine.id}
            error={editor.error}
            onSelect={editor.selectRoutine}
            onCreate={editor.createNewRoutine}
            onDelete={editor.deleteRoutine}
            onRefresh={editor.refreshCollection}
          />
          |
          <RoutineFileActions
            routine={editor.routine}
            exportDisabled={!editor.valid}
            exportErrorId={validationErrorId}
            onImport={editor.importRoutine}
            importDisabled={editor.atRoutineLimit}
            importErrorId="routine-count-limit"
          />
        </div>
      </div>
      <div className={styles.contentWrapper}>
        {editor.atRoutineLimit && (
          <p id="routine-count-limit">
            You can save up to 100 routines. Delete a routine to add another.
          </p>
        )}
        {editor.error && (
          <div role="alert">
            <p>{editor.error}</p>
            <button
              onClick={() => {
                try {
                  editor.flush()
                  editor.refreshCollection()
                } catch {
                  /* Keep error visible for retry. */
                }
              }}
            >
              Retry saving
            </button>
          </div>
        )}
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
      </div>
      <footer className={styles.editorFooter}>
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
        <button
          className={sharedStyles.primaryAction}
          disabled={!editor.valid}
          aria-describedby={!editor.valid ? validationErrorId : undefined}
          onClick={() => {
            try {
              editor.flush()
            } catch {
              return
            }
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
