import type { Routine } from '../../../domain/routine'
import { useRoutineFileActions } from '../RoutineFileActions/useRoutineFileActions'
import { RoutineImportPreview } from '../RoutineFileActions/RoutineImportPreview'
import fileStyles from '../RoutineFileActions/RoutineFileActions.module.css'
import { useEffect, useId, useRef, useState } from 'react'
import {
  BottomSheet,
  CircleCheckIcon,
  CloseIcon,
  DeleteIcon,
  MenuIcon,
  SlideToConfirm,
} from '../../../components'
import { practiceConfig } from '../../../config/practice-config'
import type { RoutineCollection } from '../../../services/persistence/routine-repository'
import { ROUTINE_MAX_COUNT } from '../../../services/persistence/routine-repository'
import { routineTotal } from '../routineTotal'
import styles from './RoutinePicker.module.css'

interface RoutinePickerProps {
  routine?: Routine
  exportDisabled?: boolean
  exportExplanation?: string
  onImport?(routine: Routine): boolean
  routines: RoutineCollection['routines']
  selectedRoutineId: string
  error: string | null
  onSelect(id: string): boolean
  onCreate(): boolean
  onDelete(id: string): boolean
  onRefresh(): void
}

export function RoutinePicker({
  routine,
  exportDisabled = false,
  exportExplanation = 'Fix the Routine validation errors before exporting.',
  onImport,
  routines,
  selectedRoutineId,
  error,
  onSelect,
  onCreate,
  onDelete,
  onRefresh,
}: RoutinePickerProps) {
  const actions = useRoutineFileActions({
    routine: routine ?? null,
    onImport: onImport ?? (() => false),
  })
  const previewContainer = useRef<HTMLDivElement>(null)
  const importButton = useRef<HTMLButtonElement>(null)
  const returningFromPreview = useRef(false)
  const exportErrorId = useId()
  useEffect(() => {
    if (actions.preview) {
      previewContainer.current?.focus()
      returningFromPreview.current = true
    } else if (returningFromPreview.current) {
      importButton.current?.focus()
      returningFromPreview.current = false
    }
  }, [actions.preview])
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
    actions.cancelImport()
    setDeletingId(null)
    setOpen(false)
  }

  return (
    <>
      <button
        className={styles.trigger}
        aria-label="Routines"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          onRefresh()
          setOpen(true)
        }}
      >
        <MenuIcon />
      </button>
      <BottomSheet
        open={open}
        title={actions.preview ? 'Import Routine' : 'Routines'}
        onClose={close}
      >
        {actions.preview ? (
          <div ref={previewContainer} tabIndex={-1}>
            <RoutineImportPreview
              actions={{
                ...actions,
                confirmImport: () => {
                  const saved = actions.confirmImport()
                  if (saved) close()
                  return saved
                },
              }}
            />
            <button className={styles.create} onClick={actions.cancelImport}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <ul ref={list} className={styles.list}>
              {ordered.map(({ routine }) => {
                const total = routineTotal(routine)
                return (
                  <li
                    key={routine.id}
                    className={styles.row}
                    data-selected={routine.id === selectedRoutineId}
                  >
                    {deletingId === routine.id ? (
                      <div ref={confirmation} className={styles.confirmation}>
                        <button
                          className={styles.cancel}
                          aria-label="Cancel"
                          onClick={() => {
                            restoreFocus.current = routine.id
                            setDeletingId(null)
                          }}
                        >
                          <CloseIcon />
                        </button>
                        <SlideToConfirm
                          label={`Slide to delete "${routine.name}"`}
                          accessibleName={`Slide to delete the routine`}
                          icon={<DeleteIcon />}
                          threshold={practiceConfig.interaction.slideToStopThreshold}
                          onConfirm={() => {
                            if (!onDelete(routine.id)) return false
                            restoreFocus.current = 'selected'
                            setDeletingId(null)
                            return true
                          }}
                        />
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
                          <span className={styles.indicator}>
                            {routine.id === selectedRoutineId && <CircleCheckIcon />}
                          </span>
                          <span className={styles.summary}>
                            <span className={styles.name}>{routine.name}</span>
                            <span className={styles.details}>
                              {total.approximate ? 'Approximately ' : ''}
                              {total.minutes} min
                            </span>
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
            {routine && (
              <>
                {exportDisabled && (
                  <p id={exportErrorId} className={styles.limit}>
                    {exportExplanation}
                  </p>
                )}
                <div className={styles.fileActions}>
                  <button
                    ref={importButton}
                    className={styles.fileAction}
                    disabled={atLimit}
                    aria-describedby={atLimit ? limitId : undefined}
                    onClick={actions.chooseImportFile}
                  >
                    Import
                  </button>
                  <button
                    className={styles.fileAction}
                    disabled={exportDisabled}
                    aria-describedby={exportDisabled ? exportErrorId : undefined}
                    onClick={actions.exportRoutine}
                  >
                    Export
                  </button>
                </div>
              </>
            )}
            {actions.status && (
              <p role="status" className={styles.limit}>
                {actions.status}
              </p>
            )}
          </>
        )}
        <input
          ref={actions.input}
          className={fileStyles.fileInput}
          tabIndex={-1}
          type="file"
          accept="application/json,.json"
          aria-label="Choose Routine file"
          onChange={actions.importFile}
        />
      </BottomSheet>
    </>
  )
}
