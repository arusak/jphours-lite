import { BottomSheet } from '../../../components'
import { practiceConfig } from '../../../config/practice-config'
import {
  EXERCISE_NAME_MAX_LENGTH,
  ROUTINE_NAME_MAX_LENGTH,
  type Exercise,
  type RoutineEntry,
} from '../../../domain/routine'
import {
  sanitizeExerciseNameInput,
  sanitizeRoutineNameInput,
} from '../../../domain/name-normalization'
import { validateEntry } from '../../../domain/validation'
import type { EditorSheet as Sheet } from '../types'
import sharedStyles from '../RoutineEditor.module.css'
import styles from './EditorSheet.module.css'

interface EditorSheetProps {
  sheet: Sheet | null
  submitted: boolean
  onChange(value: Sheet): void
  onSave(): void
  onCancel(): void
}
const minute = 60
export function EditorSheet({ sheet, submitted, onChange, onSave, onCancel }: EditorSheetProps) {
  const entry = sheet?.kind === 'entry' ? sheet.entry : null
  const errors = entry && submitted ? validateEntry(entry) : {}
  const mutate = (value: Partial<Exercise>) =>
    entry &&
    onChange({
      kind: 'entry',
      entry: { ...entry, ...value } as RoutineEntry,
      index: sheet?.kind === 'entry' ? sheet.index : null,
    })
  const durationChange = (delta: number) => {
    if (!entry) return
    const policy =
      entry.kind === 'break' ? practiceConfig.breakDuration : practiceConfig.exerciseDuration
    const base = entry.durationSec ?? (delta > 0 ? minute : policy.default)
    mutate({ durationSec: Math.max(policy.min, Math.min(policy.max, base + delta)) })
  }
  const title =
    sheet?.kind === 'routine'
      ? 'Edit routine'
      : sheet?.index === null
        ? `Add ${entry?.kind ?? 'entry'}`
        : `Edit ${entry?.kind ?? 'entry'}`
  return (
    <BottomSheet open={sheet !== null} title={title} onClose={onCancel}>
      {sheet?.kind === 'routine' ? (
        <label>
          Routine name
          <input
            value={sheet.name}
            maxLength={ROUTINE_NAME_MAX_LENGTH}
            onChange={(event) =>
              onChange({ kind: 'routine', name: sanitizeRoutineNameInput(event.target.value) })
            }
          />
        </label>
      ) : sheet?.kind === 'entry' ? (
        <>
          <>
            {entry!.kind === 'exercise' && (
              <label>
                Exercise name
                <input
                  value={entry!.title}
                  maxLength={EXERCISE_NAME_MAX_LENGTH}
                  aria-invalid={Boolean(errors.title)}
                  onChange={(event) =>
                    mutate({ title: sanitizeExerciseNameInput(event.target.value) })
                  }
                />
              </label>
            )}
          </>
          <>
            {entry!.kind === 'exercise' && (
              <label className={styles.editorStepper}>
                Tempo (<span className="small-caps">BPM</span>)
                <span>
                  <button
                    aria-label="Decrease tempo"
                    onClick={() =>
                      mutate({
                        tempoBpm: Math.max(
                          practiceConfig.tempo.min,
                          (entry!.tempoBpm ?? practiceConfig.tempo.default) - 1,
                        ),
                      })
                    }
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={practiceConfig.tempo.min}
                    max={practiceConfig.tempo.max}
                    step={practiceConfig.tempo.increment}
                    value={entry!.tempoBpm ?? ''}
                    onChange={(event) =>
                      mutate({
                        tempoBpm: event.target.value === '' ? null : Number(event.target.value),
                      })
                    }
                  />
                  <button
                    aria-label="Increase tempo"
                    onClick={() =>
                      mutate({
                        tempoBpm: Math.min(
                          practiceConfig.tempo.max,
                          (entry!.tempoBpm ?? practiceConfig.tempo.default) + 1,
                        ),
                      })
                    }
                  >
                    +
                  </button>
                </span>
              </label>
            )}
          </>
          <label className={styles.editorStepper}>
            Duration (minutes)
            <span>
              <button aria-label="Decrease duration" onClick={() => durationChange(-minute)}>
                −
              </button>
              <input
                type="number"
                min={
                  (entry!.kind === 'break'
                    ? practiceConfig.breakDuration.min
                    : practiceConfig.exerciseDuration.min) / minute
                }
                max={
                  (entry!.kind === 'break'
                    ? practiceConfig.breakDuration.max
                    : practiceConfig.exerciseDuration.max) / minute
                }
                step="1"
                value={entry!.durationSec === null ? '' : entry!.durationSec / minute}
                onChange={(event) =>
                  mutate({
                    durationSec:
                      event.target.value === '' ? null : Number(event.target.value) * minute,
                  })
                }
              />
              <button aria-label="Increase duration" onClick={() => durationChange(minute)}>
                +
              </button>
            </span>
          </label>
          {errors.title && (
            <p className={styles.editorAlert} role="alert">
              {errors.title}
            </p>
          )}
          {errors.durationSec && (
            <p className={styles.editorAlert} role="alert">
              {errors.durationSec}
            </p>
          )}
        </>
      ) : null}
      <div className={styles.sheetActions}>
        <button className={sharedStyles.primaryAction} onClick={onSave}>
          Save
        </button>
        <button className={styles.secondaryAction} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </BottomSheet>
  )
}
