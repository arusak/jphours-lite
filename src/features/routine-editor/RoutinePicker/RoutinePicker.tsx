import { useEffect, useId, useRef, useState } from 'react'
import { BottomSheet, DeleteIcon, SlideToConfirm } from '../../../components'
import { practiceConfig } from '../../../config/practice-config'
import type { RoutineCollection } from '../../../services/persistence/routine-repository'
import { ROUTINE_MAX_COUNT } from '../../../services/persistence/routine-repository'
import { routineTotal } from '../routineTotal'
import styles from './RoutinePicker.module.css'

interface RoutinePickerProps {
  routines: RoutineCollection['routines']
  selectedRoutineId: string
  error: string | null
  onSelect(id: string): boolean
  onCreate(): boolean
  onDelete(id: string): boolean
  onRefresh(): void
}

export function RoutinePicker({
  routines,
  selectedRoutineId,
  error,
  onSelect,
  onCreate,
  onDelete,
  onRefresh,
}: RoutinePickerProps) {
  const [open, setOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const confirmation = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const createButton = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef<string | null>(null)
  useEffect(() => {
    if (deletingId) {
      confirmation.current?.querySelector<HTMLElement>('[role="slider"]')?.focus()
    } else if (open && restoreFocus.current) {
      const target =
        restoreFocus.current === 'selected'
          ? list.current?.querySelector<HTMLButtonElement>('button[aria-current="true"]')
          : list.current?.querySelector<HTMLButtonElement>(
              `button[data-delete-id="${restoreFocus.current}"]`,
            )
      ;(target ?? createButton.current)?.focus()
      restoreFocus.current = null
    }
  }, [deletingId, open])
  const limitId = useId()
  const atLimit = routines.length >= ROUTINE_MAX_COUNT
  const ordered = [...routines].sort((a, b) => b.lastAccessedAt.localeCompare(a.lastAccessedAt))
  const close = () => {
    restoreFocus.current = null
    setDeletingId(null)
    setOpen(false)
  }

  return (
    <>
      <button
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          onRefresh()
          setOpen(true)
        }}
      >
        Routines
      </button>
      <BottomSheet open={open} title="Routines" onClose={close}>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <ul ref={list} className={styles.list}>
          {ordered.map(({ routine }) => {
            const total = routineTotal(routine)
            return (
              <li key={routine.id} className={styles.row}>
                {deletingId === routine.id ? (
                  <div ref={confirmation} className={styles.confirmation}>
                    <strong className={styles.name}>{routine.name}</strong>
                    <SlideToConfirm
                      label="Slide to delete"
                      accessibleName={`Slide to delete routine ${routine.name}`}
                      icon={<DeleteIcon />}
                      threshold={practiceConfig.interaction.slideToStopThreshold}
                      onConfirm={() => {
                        if (!onDelete(routine.id)) return false
                        restoreFocus.current = 'selected'
                        setDeletingId(null)
                        return true
                      }}
                    />
                    <button
                      className={styles.cancel}
                      onClick={() => {
                        restoreFocus.current = routine.id
                        setDeletingId(null)
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      className={styles.select}
                      aria-label={`Open routine ${routine.name}`}
                      aria-current={routine.id === selectedRoutineId ? 'true' : undefined}
                      onClick={() => {
                        if (routine.id === selectedRoutineId || onSelect(routine.id)) close()
                      }}
                    >
                      <span className={styles.name}>{routine.name}</span>
                      <span className={styles.details}>
                        {total.approximate ? 'Approximately ' : ''}
                        {total.minutes} min{routine.id === selectedRoutineId && ' · Selected'}
                      </span>
                    </button>
                    <button
                      className={styles.delete}
                      data-delete-id={routine.id}
                      aria-label={`Delete routine ${routine.name}`}
                      onClick={() => setDeletingId(routine.id)}
                    >
                      <DeleteIcon />
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
        {atLimit && (
          <p id={limitId} className={styles.limit}>
            You can save up to 100 routines. Delete a routine to add another.
          </p>
        )}
        <button
          ref={createButton}
          className={styles.create}
          disabled={atLimit}
          aria-describedby={atLimit ? limitId : undefined}
          onClick={() => {
            if (onCreate()) close()
          }}
        >
          New routine
        </button>
      </BottomSheet>
    </>
  )
}
