import { useEffect, useMemo, useRef, useState } from 'react'
import { practiceConfig } from '../../../config/practice-config'
import { ROUTINE_ENTRY_MAX_COUNT, createExercise, type Routine } from '../../../domain/routine'
import { normalizeExerciseName, normalizeRoutineName } from '../../../domain/name-normalization'
import { validateEntry, validateRoutine } from '../../../domain/validation'
import { DebouncedRoutineSaver } from '../../../services/persistence/debounced-routine-saver'
import type { RoutineRepository } from '../../../services/persistence/routine-repository'
import { routineTotal } from '../routineTotal'
import { moveRoutineEntry } from '../moveRoutineEntry'
import type { EditorSheet } from '../types'

const touch = (routine: Routine): Routine => ({ ...routine, updatedAt: new Date().toISOString() })
export function useRoutineEditor(repository: RoutineRepository) {
  const [routine, setRoutine] = useState<Routine>(() => repository.load())
  const [sheet, setSheet] = useState<EditorSheet | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const saver = useRef(new DebouncedRoutineSaver(repository))
  const persistedReplacement = useRef<Routine | null>(null)
  const validation = useMemo(() => validateRoutine(routine), [routine])
  const total = useMemo(() => routineTotal(routine), [routine])
  useEffect(() => {
    if (persistedReplacement.current === routine) {
      persistedReplacement.current = null
      return
    }
    persistedReplacement.current = null
    saver.current.schedule(routine)
  }, [routine])
  useEffect(() => () => saver.current.dispose(), [])
  const update = (change: (current: Routine) => Routine) =>
    setRoutine((current) => touch(change(current)))
  const close = () => {
    setSheet(null)
    setSubmitted(false)
  }
  const updateSetting = (key: 'quickRestDurationSec' | 'warningLeadTimeSec', delta: number) =>
    update((current) => {
      const policy =
        key === 'quickRestDurationSec'
          ? practiceConfig.quickRestDuration
          : practiceConfig.warningLeadTime
      return {
        ...current,
        [key]: Math.min(policy.max, Math.max(policy.min, current[key] + delta)),
      }
    })
  const save = () => {
    if (!sheet) return
    if (sheet.kind === 'routine') {
      update((current) => ({ ...current, name: normalizeRoutineName(sheet.name) }))
      close()
      return
    }
    const normalizedEntry =
      sheet.entry.kind === 'exercise'
        ? {
            ...sheet.entry,
            title: normalizeExerciseName(sheet.entry.title),
          }
        : sheet.entry
    if (Object.keys(validateEntry(normalizedEntry)).length) {
      setSubmitted(true)
      return
    }
    update((current) => ({
      ...current,
      entries:
        sheet.index === null
          ? [...current.entries, normalizedEntry]
          : current.entries.map((entry, index) =>
              index === sheet.index ? normalizedEntry : entry,
            ),
    }))
    close()
  }
  const remove = (index: number) =>
    update((current) => {
      const entries = current.entries.filter((_, itemIndex) => itemIndex !== index)
      return { ...current, entries: entries.length ? entries : [createExercise()] }
    })
  const reorder = (activeEntryId: string, targetEntryId: string) =>
    update((current) => ({
      ...current,
      entries: moveRoutineEntry(current.entries, activeEntryId, targetEntryId),
    }))
  const replaceRoutine = (replacement: Routine) => {
    repository.save(replacement)
    saver.current.cancel()
    persistedReplacement.current = replacement
    setRoutine(replacement)
    close()
  }
  return {
    routine,
    sheet,
    submitted,
    total,
    validation,
    valid: validation.valid,
    atEntryLimit: routine.entries.length >= ROUTINE_ENTRY_MAX_COUNT,
    setSheet,
    update,
    updateSetting,
    save,
    close,
    remove,
    reorder,
    replaceRoutine,
    flush: () => saver.current.flush(),
  }
}
