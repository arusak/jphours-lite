import { useSortable } from '@dnd-kit/react/sortable'
import type { Ref, RefCallback } from 'react'
import { DragHandleIcon } from '../../../components'
import type { RoutineEntry } from '../../../domain/routine'
import styles from './RoutineEntryCard.module.css'

interface RoutineEntryCardProps {
  editButtonRef?: Ref<HTMLButtonElement>
  entry: RoutineEntry
  onEdit(): void
  onDelete(): void
  cardRef?: RefCallback<HTMLElement>
  dragHandleRef?: RefCallback<HTMLButtonElement>
  sortable?: boolean
  dragging?: boolean
}

export function RoutineEntryCard({
  editButtonRef,
  entry,
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
          <h3>{name}</h3>
        </div>
        <div className={styles.exerciseMeta}>
          {entry.kind === 'exercise' && entry.tempoBpm !== null && (
            <span className={`${styles.badge} ${styles.badgeTempo}`}>
              <span className={styles.tempoLabel}>
                {entry.tempoBpm} <span className="small-caps">BPM</span>
              </span>
            </span>
          )}
          <span className={styles.badge}>
            {entry.durationSec === null ? 'Open-ended' : `${entry.durationSec / 60} min`}
          </span>
        </div>
      </div>
      <button
        ref={editButtonRef}
        className={styles.cardAction}
        aria-label={`Edit ${name}`}
        onClick={onEdit}
      >
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
  editButtonRef,
  entry,
  index,
  onEdit,
  onDelete,
  dragging = false,
}: { index: number } & Omit<RoutineEntryCardProps, 'cardRef' | 'dragHandleRef' | 'sortable'>) {
  const { handleRef, isDragSource, ref } = useSortable({
    id: entry.id,
    index,
  })
  return (
    <RoutineEntryCard
      editButtonRef={editButtonRef}
      entry={entry}
      onEdit={onEdit}
      onDelete={onDelete}
      cardRef={ref}
      dragHandleRef={handleRef}
      sortable
      dragging={dragging || isDragSource}
    />
  )
}
