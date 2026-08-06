import { useMemo, useState } from "react";
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
      exercises: persisted.exercises.map((exercise) =>
        exercise.id === sourceExerciseId ? { ...exercise, tempoBpm } : exercise,
      ),
      updatedAt: new Date().toISOString(),
    };
    repository.save(updated);
  };
  return (
    <div className="app-shell">
      {activeRoutine ? (
        <SessionPlayer
          routine={activeRoutine}
          onExit={() => setActiveRoutine(null)}
          onSaveTempo={saveSessionTempo}
        />
      ) : (
        <RoutineEditor repository={repository} onStartSession={setActiveRoutine} />
      )}
    </div>
  );
}
