import { useSortable } from '@dnd-kit/react/sortable'
import type { RefCallback } from 'react'
import { DragHandleIcon } from '../../../components'
import type { RoutineEntry } from '../../../domain/routine'
import styles from './RoutineEntryCard.module.css'

interface RoutineEntryCardProps {
  entry: RoutineEntry
  index: number
  onEdit(): void
  onDelete(): void
  cardRef?: RefCallback<HTMLElement>
  dragHandleRef?: RefCallback<HTMLButtonElement>
  sortable?: boolean
  dragging?: boolean
}

export function RoutineEntryCard({
  entry,
  index,
  onEdit,
  onDelete,
  cardRef,
  dragHandleRef,
  sortable = false,
  dragging = false,
}: RoutineEntryCardProps) {
  const name = entry.kind === 'break' ? 'Break' : entry.title
  return (
    <article
      ref={cardRef}
      className={`${styles.exerciseCard} ${entry.kind === 'break' ? styles.entryCardBreak : ''}`}
      data-dragging={dragging || undefined}
    >
      {sortable && (
        <button
          ref={dragHandleRef}
          className={styles.dragHandle}
          aria-label={`Reorder ${name}`}
          type="button"
        >
          <DragHandleIcon />
        </button>
      )}
      <div className={styles.exerciseCardContent}>
        <div className={styles.exerciseTitleRow}>
          <span>{index + 1}</span>
          <h3>{name}</h3>
        </div>
        <div className={styles.exerciseMeta}>
          {entry.kind === 'exercise' && entry.tempoBpm !== null && (
            <span className={`${styles.badge} ${styles.badgeTempo}`}>♪ {entry.tempoBpm} BPM</span>
          )}
          <span className={styles.badge}>
            ◷ {entry.durationSec === null ? 'Open-ended' : `${entry.durationSec / 60} min`}
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
  )
}

export function SortableRoutineEntryCard({
  entry,
  index,
  onEdit,
  onDelete,
  dragging = false,
}: Omit<RoutineEntryCardProps, 'cardRef' | 'dragHandleRef' | 'sortable'>) {
  const { handleRef, isDragSource, ref } = useSortable({
    id: entry.id,
    index,
  })
  return (
    <RoutineEntryCard
      entry={entry}
      index={index}
      onEdit={onEdit}
      onDelete={onDelete}
      cardRef={ref}
      dragHandleRef={handleRef}
      sortable
      dragging={dragging || isDragSource}
    />
  )
}
