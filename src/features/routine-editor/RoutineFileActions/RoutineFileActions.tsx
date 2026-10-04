import { BottomSheet } from '../../../components'
import type { Routine } from '../../../domain/routine'
import styles from './RoutineFileActions.module.css'
import { useRoutineFileActions } from './useRoutineFileActions'

interface RoutineFileActionsProps {
  routine: Routine
  exportDisabled: boolean
  exportErrorId?: string
  importDisabled?: boolean
  importErrorId?: string
  onImport(routine: Routine): boolean
}

export function RoutineFileActions({
  routine,
  exportDisabled,
  exportErrorId,
  onImport,
  importDisabled,
  importErrorId,
}: RoutineFileActionsProps) {
  const actions = useRoutineFileActions({ routine, onImport })

  return (
    <>
      <span className={styles.actions}>
        <button
          className={styles.action}
          disabled={exportDisabled}
          aria-describedby={exportDisabled ? exportErrorId : undefined}
          onClick={actions.exportRoutine}
        >
          Export
        </button>
        <button
          className={styles.action}
          disabled={importDisabled}
          aria-describedby={importDisabled ? importErrorId : undefined}
          onClick={actions.chooseImportFile}
        >
          Import
        </button>
      </span>
      <input
        ref={actions.input}
        className={styles.fileInput}
        type="file"
        accept="application/json,.json"
        aria-label="Choose Routine file"
        onChange={actions.importFile}
      />
      {actions.status && (
        <span className={styles.status} role="status">
          {actions.status}
        </span>
      )}
      <BottomSheet
        open={actions.preview !== null}
        title="Import Routine"
        onClose={actions.cancelImport}
      >
        {actions.preview && actions.previewDetails && (
          <div className={styles.preview}>
            <h3>{actions.preview.name}</h3>
            {actions.status && <p role="alert">{actions.status}</p>}
            <p>
              {actions.previewDetails.total.approximate ? 'Approximately ' : ''}
              {actions.previewDetails.total.minutes} min
            </p>
            <ul>
              {actions.previewDetails.visibleExerciseNames.map((name, index) => (
                <li key={`${name}-${index}`}>{name}</li>
              ))}
            </ul>
            {actions.previewDetails.hiddenExerciseCount > 0 && (
              <p>and {actions.previewDetails.hiddenExerciseCount} more</p>
            )}
            <button className={styles.replace} onClick={actions.confirmImport}>
              Add routine
            </button>
            <button className={styles.cancel} onClick={actions.cancelImport}>
              Cancel
            </button>
          </div>
        )}
      </BottomSheet>
    </>
  )
}
