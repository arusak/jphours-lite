import type { Routine } from "../../../domain/routine";
import { RoutineEntryCard } from "../RoutineEntryCard/RoutineEntryCard";
import styles from "./RoutineEntryList.module.css";

interface RoutineEntryListProps {
  routine: Routine;
  onEdit(index: number): void;
  onDelete(index: number): void;
}

export function RoutineEntryList({ routine, onEdit, onDelete }: RoutineEntryListProps) {
  return (
    <div className={styles.exerciseList} aria-label="Routine entries">
      {routine.entries.map((entry, index) => (
        <RoutineEntryCard
          key={entry.id}
          entry={entry}
          index={index}
          onEdit={() => onEdit(index)}
          onDelete={() => onDelete(index)}
        />
      ))}
    </div>
  );
}
