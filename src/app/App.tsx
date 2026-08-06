import { useMemo, useState } from "react";
import type { Routine } from "../domain/routine";
import { RoutineEditor } from "../features/routine-editor/RoutineEditor";
import { SessionPlayer } from "../features/session-player/SessionPlayer";
import { LocalStorageRoutineRepository } from "../services/persistence/routine-repository";

export function App() {
  const repository = useMemo(() => new LocalStorageRoutineRepository(), []);
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
  return activeRoutine ? (
    <SessionPlayer routine={activeRoutine} onExit={() => setActiveRoutine(null)} />
  ) : (
    <main className="app-shell">
      <RoutineEditor repository={repository} onStartSession={setActiveRoutine} />
    </main>
  );
}
