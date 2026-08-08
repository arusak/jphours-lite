import type { Routine, RoutineEntry } from "../../domain/routine";

export type EditorSheet =
  | { kind: "routine"; name: string }
  | { kind: "entry"; entry: RoutineEntry; index: number | null };

export interface RoutineEditorProps {
  repository: import("../../services/persistence/routine-repository").RoutineRepository;
  onStartSession?(routine: Routine): void;
}
