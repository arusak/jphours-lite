import { useRef } from 'react'
import { HandDrawnArrow } from '../../../components'
import { useRoutineHintAnchors, type RoutineHintTargets } from './useRoutineHintAnchors'
import { hintKeys, routineHintConfig, type RoutineHintKey } from './routine-hint-config'
import styles from './RoutineHints.module.css'

export function RoutineHints(props: RoutineHintTargets) {
  const labelsRef = useRef<Partial<Record<RoutineHintKey, HTMLSpanElement>>>({})
  const anchors = useRoutineHintAnchors(props, labelsRef)
  return (
    <div className={styles.overlay}>
      {hintKeys.map((key) => {
        const anchor = anchors.find((anchor) => anchor.key === key)
        return (
          <div key={key}>
            <span
              ref={(element) => {
                if (element) labelsRef.current[key] = element
                else delete labelsRef.current[key]
              }}
              className={styles.label}
              style={{
                left: anchor?.left ?? 0,
                top: anchor?.top ?? 0,
                visibility: anchor ? 'visible' : 'hidden',
              }}
            >
              {routineHintConfig.hints[key].label.text}
            </span>
            {anchor && <HandDrawnArrow className={styles.arrow} path={anchor.path} />}
          </div>
        )
      })}
    </div>
  )
}
