import { useEffect, useRef } from 'react'
import { BreakIcon, ExerciseIcon, TimerRing } from '../../../components'
import { formatTime } from '../formatTime'
import styles from './SessionTimer.module.css'
import cn from 'clsx'
import { TEMPO_LONG_PRESS_DELAY_MS, TEMPO_REPEAT_RATE_PER_SECOND } from './tempoPressConstants'

interface SessionTimerProps {
  tempo: number | null
  savedTempo: number | null
  isBreak: boolean
  isQuickRest: boolean
  displaySeconds: number | null
  elapsedSeconds: number
  progress: number | null
  discreteProgress?: boolean
  tone: 'exercise' | 'break' | 'quick-rest'
  onChangeTempo(delta: number): boolean
  onSaveTempo(): void
}
export function SessionTimer({
  tempo,
  savedTempo,
  isBreak,
  isQuickRest,
  displaySeconds,
  elapsedSeconds,
  progress,
  discreteProgress = false,
  tone,
  onChangeTempo,
  onSaveTempo,
}: SessionTimerProps) {
  const activePointerId = useRef<number | null>(null)
  const activeButton = useRef<HTMLButtonElement | null>(null)
  const delayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const crossedLongPressBoundary = useRef(false)
  const suppressNextClick = useRef(false)
  const ignoredPointerIds = useRef(new Set<number>())
  const onChangeTempoRef = useRef(onChangeTempo)
  onChangeTempoRef.current = onChangeTempo

  const stopTimers = () => {
    if (delayTimer.current !== null) {
      clearTimeout(delayTimer.current)
      delayTimer.current = null
    }
    if (repeatTimer.current !== null) {
      clearInterval(repeatTimer.current)
      repeatTimer.current = null
    }
  }

  const clearActivePointer = () => {
    const pointerId = activePointerId.current
    const button = activeButton.current
    stopTimers()
    activePointerId.current = null
    activeButton.current = null
    crossedLongPressBoundary.current = false
    if (pointerId !== null && button?.hasPointerCapture?.(pointerId)) {
      button.releasePointerCapture?.(pointerId)
    }
  }

  useEffect(() => clearActivePointer, [isQuickRest])

  const onTempoPointerDown = (event: React.PointerEvent<HTMLButtonElement>, delta: number) => {
    if (activePointerId.current !== null) {
      ignoredPointerIds.current.add(event.pointerId)
      event.preventDefault()
      return
    }

    ignoredPointerIds.current.delete(event.pointerId)
    activePointerId.current = event.pointerId
    activeButton.current = event.currentTarget
    event.currentTarget.setPointerCapture?.(event.pointerId)
    delayTimer.current = setTimeout(() => {
      delayTimer.current = null
      crossedLongPressBoundary.current = true
      if (!onChangeTempoRef.current(delta)) return

      const interval = 1_000 / TEMPO_REPEAT_RATE_PER_SECOND
      repeatTimer.current = setInterval(() => {
        if (!onChangeTempoRef.current(delta)) stopTimers()
      }, interval)
    }, TEMPO_LONG_PRESS_DELAY_MS)
  }

  const onTempoPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerId !== activePointerId.current) return
    if (crossedLongPressBoundary.current) suppressNextClick.current = true
    clearActivePointer()
  }

  const onTempoPointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (ignoredPointerIds.current.delete(event.pointerId)) return
    if (event.pointerId === activePointerId.current) clearActivePointer()
  }

  const onTempoLostPointerCapture = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (ignoredPointerIds.current.delete(event.pointerId)) return
    if (event.pointerId === activePointerId.current) clearActivePointer()
  }

  const onTempoClick = (event: React.MouseEvent<HTMLButtonElement>, delta: number) => {
    const pointerId = (event.nativeEvent as PointerEvent).pointerId
    if (typeof pointerId === 'number' && ignoredPointerIds.current.delete(pointerId)) return
    if (suppressNextClick.current) {
      suppressNextClick.current = false
      return
    }
    onChangeTempo(delta)
  }

  const time = formatTime(displaySeconds ?? elapsedSeconds)
  const timerDescription = displaySeconds === null ? 'Elapsed time' : 'Remaining time'
  return (
    <TimerRing
      accessibleName={`${timerDescription}: ${time}`}
      progress={progress}
      tone={tone}
      discreteProgress={discreteProgress}
    >
      {tempo !== null ? (
        <div className={styles.ringTempoControl}>
          <button
            aria-label="Decrease tempo"
            onPointerDown={(event) => onTempoPointerDown(event, -1)}
            onPointerUp={onTempoPointerUp}
            onPointerCancel={onTempoPointerCancel}
            onLostPointerCapture={onTempoLostPointerCapture}
            onClick={(event) => onTempoClick(event, -1)}
          >
            −
          </button>
          <strong>
            {tempo}
            <small className="small-caps">BPM</small>
          </strong>
          <button
            aria-label="Increase tempo"
            onPointerDown={(event) => onTempoPointerDown(event, 1)}
            onPointerUp={onTempoPointerUp}
            onPointerCancel={onTempoPointerCancel}
            onLostPointerCapture={onTempoLostPointerCapture}
            onClick={(event) => onTempoClick(event, 1)}
          >
            +
          </button>
          <button
            className={cn(styles.ringSave, tempo === savedTempo && styles.hidden)}
            aria-label="Save tempo"
            onClick={onSaveTempo}
          >
            Save
          </button>
        </div>
      ) : (
        <>
          {!isQuickRest &&
            (isBreak ? (
              <BreakIcon
                className={`${styles.sessionIcon} ${styles.breakIcon}`}
                data-testid="break-icon"
              />
            ) : (
              <ExerciseIcon className={styles.sessionIcon} data-testid="exercise-icon" />
            ))}
          <span className={styles.ringTime}>{time}</span>
        </>
      )}
    </TimerRing>
  )
}
