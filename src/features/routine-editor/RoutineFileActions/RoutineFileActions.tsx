import { RoutineImportPreview } from './RoutineImportPreview'
import { BottomSheet } from '../../../components'
import type { Routine } from '../../../domain/routine'
import styles from './RoutineFileActions.module.css'
import { useRoutineFileActions } from './useRoutineFileActions'

interface RoutineFileActionsProps {
  routine: Routine | null
  exportDisabled: boolean
  exportErrorId?: string
  importDisabled?: boolean
  importErrorId?: string
  importLabel?: string
  onImport(routine: Routine): boolean
}

export function RoutineFileActions({
  routine,
  exportDisabled,
  exportErrorId,
  onImport,
  importDisabled,
  importErrorId,
  importLabel = 'Import',
}: RoutineFileActionsProps) {
  const actions = useRoutineFileActions({ routine, onImport })

  return (
    <>
      <span className={styles.actions}>
        {routine && (
          <button
            className={styles.action}
            disabled={exportDisabled}
            aria-describedby={exportDisabled ? exportErrorId : undefined}
            onClick={actions.exportRoutine}
          >
            Export
          </button>
        )}
        <button
          className={styles.action}
          disabled={importDisabled}
          aria-describedby={importDisabled ? importErrorId : undefined}
          onClick={actions.chooseImportFile}
        >
          {importLabel}
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
        {actions.preview && actions.previewDetails && <RoutineImportPreview actions={actions} />}
      </BottomSheet>
    </>
  )
}
