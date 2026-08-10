import { BreakIcon, ExerciseIcon, TimerRing } from '../../../components'
import { formatTime } from '../formatTime'
import styles from './SessionTimer.module.css'
import cn from 'clsx'

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
  onChangeTempo(delta: number): void
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
          <button aria-label="Decrease tempo" onClick={() => onChangeTempo(-1)}>
            −
          </button>
          <strong>
            {tempo}
            <small>BPM</small>
          </strong>
          <button aria-label="Increase tempo" onClick={() => onChangeTempo(1)}>
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
