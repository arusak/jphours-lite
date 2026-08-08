import type { RoutineEntry } from "../../domain/routine";

interface RoutineEntryCardProps {
  entry: RoutineEntry;
  index: number;
  onEdit(): void;
  onDelete(): void;
}

export function RoutineEntryCard({ entry, index, onEdit, onDelete }: RoutineEntryCardProps) {
  const name = entry.kind === "break" ? "Break" : entry.title;
  return (
    <article className={`exercise-card entry-card entry-card--${entry.kind}`}>
      <div className="exercise-card-content">
        <div className="exercise-title-row">
          <span>{index + 1}</span>
          <h3>{name}</h3>
        </div>
        <div className="exercise-meta">
          {entry.kind === "exercise" && entry.tempoBpm !== null && (
            <span className="badge tempo">♪ {entry.tempoBpm} BPM</span>
          )}
          <span className="badge">
            ◷ {entry.durationSec === null ? "Open-ended" : `${entry.durationSec / 60} min`}
          </span>
        </div>
      </div>
      <button className="card-action" aria-label={`Edit ${name}`} onClick={onEdit}>
        ✎
      </button>
      <button className="card-action delete" aria-label={`Delete ${name}`} onClick={onDelete}>
        ×
      </button>
    </article>
  );
}
