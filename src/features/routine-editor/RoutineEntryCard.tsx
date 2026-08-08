import type { RoutineEntry } from "../../domain/routine";
import styles from "./RoutineEditor.module.css";

interface RoutineEntryCardProps {
  entry: RoutineEntry;
  index: number;
  onEdit(): void;
  onDelete(): void;
}

export function RoutineEntryCard({ entry, index, onEdit, onDelete }: RoutineEntryCardProps) {
  const name = entry.kind === "break" ? "Break" : entry.title;
  return (
    <article
      className={`${styles.exerciseCard} ${entry.kind === "break" ? styles.entryCardBreak : ""}`}
    >
      <div className={styles.exerciseCardContent}>
        <div className={styles.exerciseTitleRow}>
          <span>{index + 1}</span>
          <h3>{name}</h3>
        </div>
        <div className={styles.exerciseMeta}>
          {entry.kind === "exercise" && entry.tempoBpm !== null && (
            <span className={`${styles.badge} ${styles.badgeTempo}`}>♪ {entry.tempoBpm} BPM</span>
          )}
          <span className={styles.badge}>
            ◷ {entry.durationSec === null ? "Open-ended" : `${entry.durationSec / 60} min`}
          </span>
        </div>
      </div>
      <button className={styles.cardAction} aria-label={`Edit ${name}`} onClick={onEdit}>
        ✎
      </button>
      <button
        className={`${styles.cardAction} ${styles.delete}`}
        aria-label={`Delete ${name}`}
        onClick={onDelete}
      >
        ×
      </button>
    </article>
  );
}
