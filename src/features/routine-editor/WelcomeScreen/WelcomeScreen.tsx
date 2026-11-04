import { RoutineFileActions } from '../RoutineFileActions/RoutineFileActions'
import styles from './WelcomeScreen.module.css'

interface WelcomeScreenProps {
  error: string | null
  importDisabled: boolean
  onCreateEmpty(): boolean
  onCreateRandom(): boolean
  onImport(routine: import('../../../domain/routine').Routine): boolean
}

export function WelcomeScreen({
  error,
  importDisabled,
  onCreateEmpty,
  onCreateRandom,
  onImport,
}: WelcomeScreenProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  return (
    <main className={styles.welcome} aria-labelledby="welcome-title">
      <div className={styles.content}>
        <h1 ref={heading} id="welcome-title" tabIndex={-1}>
          Welcome! Make time for your practice.
        </h1>
        <p>
          This app will help you practice rhythm by guiding you through timed, metronome-paced
          exercises.
        </p>
        <p>Start with a simple Routine, or let us make one for you.</p>
        {error && <p role="alert">{error}</p>}
        <div className={styles.actions}>
          <button className={styles.primary} onClick={onCreateEmpty}>
            Create empty routine
          </button>
          <button className={styles.secondary} onClick={onCreateRandom}>
            Create random routine
          </button>
          <RoutineFileActions
            routine={null}
            exportDisabled
            importDisabled={importDisabled}
            importErrorId="routine-count-limit"
            importLabel="Import routine"
            onImport={onImport}
          />
        </div>
      </div>
    </main>
  )
}
import { useEffect, useRef } from 'react'
