import { useEffect, useState, type RefObject } from 'react'
import {
  layoutRoutineHints,
  type RoutineHintAnchor,
  type RoutineHintMeasurements,
} from './routine-hint-layout'
import { hintKeys, type RoutineHintKey } from './routine-hint-config'

export interface RoutineHintTargets {
  containerRef: RefObject<HTMLElement | null>
  addExerciseRef: RefObject<HTMLButtonElement | null>
  settingsRef: RefObject<HTMLButtonElement | null>
  editExerciseRef: RefObject<HTMLButtonElement | null>
}

export function useRoutineHintAnchors(
  targets: RoutineHintTargets,
  labelsRef: RefObject<Partial<Record<RoutineHintKey, HTMLSpanElement>>>,
) {
  const { containerRef, addExerciseRef, settingsRef, editExerciseRef } = targets
  const [anchors, setAnchors] = useState<RoutineHintAnchor[]>([])
  useEffect(() => {
    const measure = () => {
      if (settingsRef.current?.getAttribute('aria-expanded') === 'true') {
        setAnchors([])
        return
      }
      const refs = { settings: settingsRef, edit: editExerciseRef, add: addExerciseRef }
      const measured: RoutineHintMeasurements['targets'] = {}
      for (const key of hintKeys) {
        const element = refs[key].current
        if (!element) continue
        measured[key] = {
          rect: element.getBoundingClientRect(),
          iconRect: element.firstElementChild?.getBoundingClientRect(),
          hidden: !!element.closest('[aria-hidden="true"], [inert]'),
        }
      }
      setAnchors(
        layoutRoutineHints({
          container: containerRef.current?.getBoundingClientRect(),
          card: editExerciseRef.current?.closest('article')?.getBoundingClientRect(),
          viewport: { width: window.innerWidth, height: window.innerHeight },
          targets: measured,
          labels: Object.fromEntries(
            hintKeys.map((key) => [key, labelsRef.current[key]?.getBoundingClientRect()]),
          ),
        }),
      )
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    for (const label of Object.values(labelsRef.current)) observer?.observe(label)
    const observed = new Set<Element>()
    for (const ref of [containerRef, addExerciseRef, settingsRef, editExerciseRef]) {
      // An expanding ancestor can move targets without resizing the targets themselves.
      let element: HTMLElement | null = ref.current
      while (element && !observed.has(element)) {
        observed.add(element)
        observer?.observe(element)
        if (element === containerRef.current) break
        element = element.parentElement
      }
    }
    const visibilityObserver = new MutationObserver(measure)
    if (containerRef.current)
      visibilityObserver.observe(containerRef.current, {
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-hidden', 'inert', 'aria-expanded'],
      })
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      observer?.disconnect()
      visibilityObserver.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [containerRef, addExerciseRef, settingsRef, editExerciseRef, labelsRef])
  return anchors
}
