import { PointerActivationConstraints } from '@dnd-kit/dom'
import { RestrictToElement } from '@dnd-kit/dom/modifiers'
import { DragDropProvider, DragOverlay, KeyboardSensor, PointerSensor } from '@dnd-kit/react'
import { isSortable } from '@dnd-kit/react/sortable'
import { useState } from 'react'
import type { Routine } from '../../../domain/routine'
import { targetRoutineEntryId } from '../moveRoutineEntry'
import { RoutineEntryCard, SortableRoutineEntryCard } from '../RoutineEntryCard/RoutineEntryCard'
import styles from './RoutineEntryList.module.css'

const defaultActivationConstraints = PointerSensor.defaults.activationConstraints

const sensors = [
  PointerSensor.configure({
    activationConstraints: (event, source) =>
      event.pointerType === 'touch'
        ? [new PointerActivationConstraints.Delay({ value: 100, tolerance: 5 })]
        : typeof defaultActivationConstraints === 'function'
          ? defaultActivationConstraints(event, source)
          : defaultActivationConstraints,
  }),
  KeyboardSensor,
]

const modifiers = [
  RestrictToElement.configure({
    element: (operation) => operation.source?.element?.parentElement ?? null,
  }),
]

interface RoutineEntryListProps {
  routine: Routine
  onEdit(index: number): void
  onDelete(index: number): void
  onReorder(activeEntryId: string, targetEntryId: string): void
}

export function RoutineEntryList({ routine, onEdit, onDelete, onReorder }: RoutineEntryListProps) {
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null)
  const activeEntry = routine.entries.find(({ id }) => id === activeEntryId)
  return (
    <DragDropProvider
      sensors={sensors}
      modifiers={modifiers}
      onDragStart={(event) => setActiveEntryId(String(event.operation.source?.id ?? ''))}
      onDragEnd={(event) => {
        const source = event.operation.source
        const sourceId = String(source?.id ?? '')
        const targetId = event.canceled
          ? ''
          : isSortable(source)
            ? targetRoutineEntryId(routine.entries, source.sortable.index)
            : String(event.operation.target?.id ?? '')
        if (sourceId && targetId) onReorder(sourceId, targetId)
        setActiveEntryId(null)
      }}
    >
      <div className={styles.exerciseList} aria-label="Routine entries">
        {routine.entries.map((entry, index) => (
          <SortableRoutineEntryCard
            key={entry.id}
            entry={entry}
            index={index}
            dragging={entry.id === activeEntryId}
            onEdit={() => onEdit(index)}
            onDelete={() => onDelete(index)}
          />
        ))}
      </div>
      <DragOverlay className={styles.dragOverlay}>
        {activeEntry && (
          <RoutineEntryCard entry={activeEntry} sortable onEdit={() => {}} onDelete={() => {}} />
        )}
      </DragOverlay>
    </DragDropProvider>
  )
}
