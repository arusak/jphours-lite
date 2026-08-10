import { useMemo, useState } from 'react'
import type { MetronomeSound } from '../config/practice-config'
import type { Routine } from '../domain/routine'
import { RoutineEditor } from '../features/routine-editor/RoutineEditor/RoutineEditor'
import { SessionPlayer } from '../features/session-player/SessionPlayer/SessionPlayer'
import { LocalStorageRoutineRepository } from '../services/persistence/routine-repository'
import styles from './App.module.css'

export function App() {
  const repository = useMemo(() => new LocalStorageRoutineRepository(), [])
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null)
  const saveSessionTempo = (sourceExerciseId: string, tempoBpm: number) => {
    if (!activeRoutine) return
    const persisted = repository.load()
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
    const persisted = repository.load()
    repository.save({ ...persisted, metronomeSound, updatedAt: new Date().toISOString() })
  }
  const saveSessionAlternateBeatTone = (alternateBeatTone: boolean) => {
    if (!activeRoutine) return
    const persisted = repository.load()
    repository.save({ ...persisted, alternateBeatTone, updatedAt: new Date().toISOString() })
  }
  return (
    <div className={styles.appShell}>
      {activeRoutine ? (
        <SessionPlayer
          routine={activeRoutine}
          onExit={() => setActiveRoutine(null)}
          onSaveTempo={saveSessionTempo}
          onSaveMetronomeSound={saveSessionMetronomeSound}
          onSaveAlternateBeatTone={saveSessionAlternateBeatTone}
        />
      ) : (
        <RoutineEditor repository={repository} onStartSession={setActiveRoutine} />
      )}
    </div>
  )
}
