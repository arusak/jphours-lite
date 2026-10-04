import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import styles from './SlideToConfirm.module.css'

interface SlideToConfirmProps {
  label: string
  accessibleName: string
  icon: ReactNode
  threshold: number
  onConfirm(): boolean | void
}
export function SlideToConfirm({
  label,
  accessibleName,
  icon,
  threshold: thresholdFraction,
  onConfirm,
}: SlideToConfirmProps) {
  const [value, setValue] = useState(0)
  const [dragging, setDragging] = useState(false)
  const fired = useRef(false)
  const pointerStartX = useRef(0)
  const threshold = thresholdFraction * 100
  const commit = (next: number) => {
    setValue(next)
    if (next >= threshold && !fired.current) {
      fired.current = true
      if (onConfirm() === false) {
        fired.current = false
        setValue(0)
      }
    }
  }
  const pointerValue = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return Math.round(
      Math.min(
        100,
        Math.max(0, ((event.clientX - bounds.left - 4) / Math.max(1, bounds.width - 56)) * 100),
      ),
    )
  }
  return (
    <div
      className={styles.slideToConfirm}
      style={{ '--slider-value': value / 100 } as CSSProperties}
      role="slider"
      tabIndex={0}
      aria-label={accessibleName}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      data-dragging={dragging}
      onPointerDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        const thumbLeft = Math.max(3, ((bounds.width - 54) * value) / 100)
        const position = event.clientX - bounds.left
        if (position < thumbLeft || position > thumbLeft + 48) return
        pointerStartX.current = event.clientX
        fired.current = false
        setDragging(true)
        event.currentTarget.setPointerCapture?.(event.pointerId)
        setValue(pointerValue(event))
      }}
      onPointerMove={(event) => {
        if (dragging) setValue(pointerValue(event))
      }}
      onPointerUp={(event) => {
        if (!dragging) return
        const next = pointerValue(event)
        setDragging(false)
        if (event.clientX <= pointerStartX.current) {
          setValue(0)
          return
        }
        commit(next)
        if (next < threshold) setValue(0)
      }}
      onPointerCancel={() => {
        setDragging(false)
        fired.current = false
        setValue(0)
      }}
      onKeyDown={(event) => {
        if (['End', 'Home', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown'].includes(event.key))
          event.preventDefault()
        if (event.key === 'End') commit(100)
        else if (event.key === 'Home') {
          fired.current = false
          setValue(0)
        } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp')
          commit(Math.min(100, value + 10))
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
          setValue(Math.max(0, value - 10))
      }}
      onBlur={() => {
        if (value < threshold) {
          fired.current = false
          setValue(0)
        }
      }}
    >
      <span>{icon}</span>
      <strong>{label}</strong>
    </div>
  )
}
