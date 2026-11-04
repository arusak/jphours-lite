import { useEffect, useState, type RefObject } from 'react'

export interface RoutineHintTargets {
  containerRef: RefObject<HTMLElement | null>
  addExerciseRef: RefObject<HTMLButtonElement | null>
  settingsRef: RefObject<HTMLButtonElement | null>
  editExerciseRef: RefObject<HTMLButtonElement | null>
}

export interface RoutineHintAnchor {
  key: 'add' | 'settings' | 'edit'
  left: number
  top: number
  width: number
  path: string
}

export function useRoutineHintAnchors(targets: RoutineHintTargets) {
  const { containerRef, addExerciseRef, settingsRef, editExerciseRef } = targets
  const [anchors, setAnchors] = useState<RoutineHintAnchor[]>([])
  useEffect(() => {
    const measure = () => {
      const container = containerRef.current?.getBoundingClientRect()
      if (!container || !container.width) {
        setAnchors([])
        return
      }
      const viewportHeight = window.innerHeight
      const left = Math.max(8, container.left + 16)
      const right = Math.min(window.innerWidth - 8, container.right - 16)
      const width = Math.min(200, right - left)
      const cardBottom = editExerciseRef.current?.closest('article')?.getBoundingClientRect().bottom
      const next: RoutineHintAnchor[] = []
      for (const [key, ref] of [
        ['settings', settingsRef],
        ['edit', editExerciseRef],
        ['add', addExerciseRef],
      ] as const) {
        const element = ref.current
        if (!element || element.closest('[aria-hidden="true"], [inert]')) continue
        const rect = element.getBoundingClientRect()
        if (
          !rect.width ||
          !rect.height ||
          rect.top < 0 ||
          rect.bottom > viewportHeight ||
          rect.left < 0 ||
          rect.right > window.innerWidth
        )
          continue
        const addTop = addExerciseRef.current?.getBoundingClientRect().top ?? viewportHeight
        const compact = !!cardBottom && addTop - cardBottom < 160
        const tight = !!cardBottom && addTop - cardBottom < 96
        const cardTop =
          editExerciseRef.current?.closest('article')?.getBoundingClientRect().top ?? 0
        const settingsBottom = settingsRef.current?.getBoundingClientRect().bottom ?? cardTop
        // Extremely dense layouts have no room for passive copy without obscuring content.
        if (tight && cardTop - settingsBottom < 88) continue
        const top = tight
          ? settingsBottom + 4 + { settings: 0, edit: 1, add: 2 }[key] * 28
          : key === 'add'
            ? rect.top - (compact ? 32 : 48)
            : (cardBottom || rect.bottom) +
              (key === 'settings' ? (compact ? 4 : 12) : compact ? 32 : 44)
        if (top < 8 || top + 24 > viewportHeight) continue
        const labelLeft = key === 'add' || tight ? left : Math.max(left, right - width - 24)
        const labelWidth = width
        const x =
          key === 'add'
            ? rect.left + rect.width / 2
            : rect.right - (key === 'settings' ? 12 : rect.width / 2)
        const y = key === 'add' ? rect.top - 3 : rect.bottom + 3
        const startX = key === 'add' ? labelLeft + labelWidth / 2 : labelLeft + labelWidth
        const startY = top + 24
        const bend = Math.min(right, Math.max(startX, x) + 18)
        const headY = y + (key === 'add' ? -6 : 6)
        const approachY = y + (key === 'add' ? -20 : 20)
        const path = `M ${startX} ${startY} C ${bend} ${startY + 8}, ${bend} ${approachY}, ${x} ${y} M ${x - 4} ${headY} L ${x} ${y} L ${x + 5} ${headY}`
        next.push({ key, left: labelLeft, top, width: labelWidth, path })
      }
      setAnchors(next)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    for (const ref of [containerRef, addExerciseRef, settingsRef, editExerciseRef]) {
      if (ref.current) {
        observer?.observe(ref.current)
        if (ref.current.parentElement) observer?.observe(ref.current.parentElement)
      }
    }
    const visibilityObserver = new MutationObserver(measure)
    if (containerRef.current)
      visibilityObserver.observe(containerRef.current, {
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-hidden', 'inert'],
      })
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      observer?.disconnect()
      visibilityObserver.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [containerRef, addExerciseRef, settingsRef, editExerciseRef])
  return anchors
}
