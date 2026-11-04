import { HandDrawnArrow } from '../../../components'
import { useRoutineHintAnchors, type RoutineHintTargets } from './useRoutineHintAnchors'
import styles from './RoutineHints.module.css'

const labels = {
  add: 'Add an exercise',
  settings: 'Adjust routine settings',
  edit: 'Edit this exercise',
}

export function RoutineHints(props: RoutineHintTargets) {
  const anchors = useRoutineHintAnchors(props)
  return (
    <div className={styles.overlay}>
      {anchors.map(({ key, left, top, width, path }) => (
        <div key={key}>
          <span className={styles.label} style={{ left, top, width }}>
            {labels[key]}
          </span>
          <HandDrawnArrow className={styles.arrow} path={path} />
        </div>
      ))}
    </div>
  )
}
