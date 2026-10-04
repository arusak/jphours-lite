import { useEffect, useMemo, useRef, useState } from 'react'
import type { MetronomeSound } from '../config/practice-config'
import type { Routine } from '../domain/routine'
import { RoutineEditor } from '../features/routine-editor/RoutineEditor/RoutineEditor'
import { SessionPlayer } from '../features/session-player/SessionPlayer/SessionPlayer'
import { AudioController } from '../services/audio'
import { LocalStorageRoutineRepository } from '../services/persistence/routine-repository'
import styles from './App.module.css'

export function App() {
  const repository = useMemo(() => new LocalStorageRoutineRepository(), [])
  const audio = useMemo(() => new AudioController(), [])
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null)
  const [initializationAttempt, setInitializationAttempt] = useState(0)
  const attemptedInitialization = useRef<number | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [initializationError, setInitializationError] = useState<string | null>(null)

  useEffect(() => {
    if (attemptedInitialization.current === initializationAttempt) return
    attemptedInitialization.current = initializationAttempt
    try {
      repository.select(repository.load().id)
      setInitializationError(null)
      setInitialized(true)
    } catch (error) {
      setInitializationError(
        error instanceof Error ? error.message : 'Your routines could not be opened.',
      )
    }
  }, [repository, initializationAttempt])

  useEffect(() => () => audio.dispose(), [audio])

  const startSession = (routine: Routine) => {
    void audio.ensureRunning()
    setActiveRoutine(routine)
  }

  const exitSession = () => {
    audio.dispose()
    setActiveRoutine(null)
  }

  const saveSessionTempo = (sourceExerciseId: string, tempoBpm: number) => {
    if (!activeRoutine) return
    const persisted = repository.load(activeRoutine.id)
    const updated = {
      ...persisted,
      entries: persisted.entries.map((entry) =>
        entry.kind === 'exercise' && entry.id === sourceExerciseId ? { ...entry, tempoBpm } : entry,
      ),
      updatedAt: new Date().toISOString(),
    }
    repository.save(updated)
  }
  const saveSessionMetronomeSound = (metronomeSound: MetronomeSound) => {
    if (!activeRoutine) return
    const persisted = repository.load(activeRoutine.id)
    repository.save({ ...persisted, metronomeSound, updatedAt: new Date().toISOString() })
  }
  const saveSessionAlternateBeatTone = (alternateBeatTone: boolean) => {
    if (!activeRoutine) return
    const persisted = repository.load(activeRoutine.id)
    repository.save({ ...persisted, alternateBeatTone, updatedAt: new Date().toISOString() })
  }
  return (
    <div className={styles.appShell}>
      {!initialized ? (
        initializationError ? (
          <main>
            <p role="alert">Unable to open your routines. {initializationError}</p>
            <button onClick={() => setInitializationAttempt((attempt) => attempt + 1)}>
              Retry
            </button>
          </main>
        ) : (
          <p role="status">Opening your routines…</p>
        )
      ) : activeRoutine ? (
        <SessionPlayer
          routine={activeRoutine}
          audio={audio}
          onExit={exitSession}
          onSaveTempo={saveSessionTempo}
          onSaveMetronomeSound={saveSessionMetronomeSound}
          onSaveAlternateBeatTone={saveSessionAlternateBeatTone}
        />
      ) : (
        <RoutineEditor repository={repository} onStartSession={startSession} />
      )}
    </div>
  )
}
