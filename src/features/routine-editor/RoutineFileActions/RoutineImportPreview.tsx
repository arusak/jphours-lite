import type { useRoutineFileActions } from './useRoutineFileActions'
import styles from './RoutineFileActions.module.css'

export function RoutineImportPreview({
  actions,
}: {
  actions: ReturnType<typeof useRoutineFileActions>
}) {
  if (!actions.preview || !actions.previewDetails) return null
  return (
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
    </div>
  )
}
