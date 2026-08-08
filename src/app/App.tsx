import { useMemo, useState } from "react";
import type { MetronomeSound } from "../config/practice-config";
import type { Routine } from "../domain/routine";
import { RoutineEditor } from "../features/routine-editor/RoutineEditor";
import { SessionPlayer } from "../features/session-player/SessionPlayer";
import { LocalStorageRoutineRepository } from "../services/persistence/routine-repository";

export function App() {
  const repository = useMemo(() => new LocalStorageRoutineRepository(), []);
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
  const saveSessionTempo = (sourceExerciseId: string, tempoBpm: number) => {
    if (!activeRoutine) return;
    const persisted = repository.load();
    const updated = {
      ...persisted,
      entries: persisted.entries.map((entry) =>
        entry.kind === "exercise" && entry.id === sourceExerciseId ? { ...entry, tempoBpm } : entry,
      ),
      exercises: persisted.exercises.map((exercise) =>
        exercise.id === sourceExerciseId ? { ...exercise, tempoBpm } : exercise,
      ),
      updatedAt: new Date().toISOString(),
    };
    repository.save(updated);
  };
  const saveSessionMetronomeSound = (metronomeSound: MetronomeSound) => {
    if (!activeRoutine) return;
    const persisted = repository.load();
    repository.save({ ...persisted, metronomeSound, updatedAt: new Date().toISOString() });
  };
  return (
    <div className="app-shell">
      {activeRoutine ? (
        <SessionPlayer
          routine={activeRoutine}
          onExit={() => setActiveRoutine(null)}
          onSaveTempo={saveSessionTempo}
          onSaveMetronomeSound={saveSessionMetronomeSound}
        />
      ) : (
        <RoutineEditor repository={repository} onStartSession={setActiveRoutine} />
      )}
    </div>
  );
}
