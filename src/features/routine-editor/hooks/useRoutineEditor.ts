import { useEffect, useMemo, useRef, useState } from 'react'
import { practiceConfig } from '../../../config/practice-config'
import { ROUTINE_ENTRY_MAX_COUNT, createExercise, type Routine } from '../../../domain/routine'
import { normalizeExerciseName, normalizeRoutineName } from '../../../domain/name-normalization'
import { validateEntry, validateRoutine } from '../../../domain/validation'
import { DebouncedRoutineSaver } from '../../../services/persistence/debounced-routine-saver'
import {
  ROUTINE_MAX_COUNT,
  type RoutineCollection,
  type RoutineRepository,
} from '../../../services/persistence/routine-repository'
import { routineTotal } from '../routineTotal'
import { moveRoutineEntry } from '../moveRoutineEntry'
import { createBlankRoutine, createRandomRoutine } from '../routine-creation'
import type { EditorSheet } from '../types'

const touch = (routine: Routine): Routine => ({ ...routine, updatedAt: new Date().toISOString() })
export function useRoutineEditor(repository: RoutineRepository) {
  const [initial] = useState(() => repository.loadCollection())
  const [routine, setRoutine] = useState<Routine | null>(
    () =>
      initial.routines.find((item) => item.routine.id === initial.selectedRoutineId)?.routine ??
      null,
  )
  const [collection, setCollection] = useState(() => initial)
  const [error, setError] = useState<string | null>(null)
  const reportError = (cause: unknown) =>
    setError(
      `Could not save routines. Check browser storage and retry. ${cause instanceof Error ? cause.message : ''}`,
    )
  const [sheet, setSheet] = useState<EditorSheet | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const saver = useRef(new DebouncedRoutineSaver(repository, 300, reportError))
  const persistedReplacement = useRef<Routine | null>(null)
  const validation = useMemo(() => (routine ? validateRoutine(routine) : null), [routine])
  const total = useMemo(() => (routine ? routineTotal(routine) : null), [routine])
  useEffect(() => {
    if (persistedReplacement.current === routine) {
      persistedReplacement.current = null
      return
    }
    persistedReplacement.current = null
    if (routine) saver.current.schedule(routine)
  }, [routine])
  useEffect(
    () => () => {
      try {
        saver.current.dispose()
      } catch {
        /* Pending writes were already reported before leaving. */
      }
    },
    [],
  )
  const update = (change: (current: Routine) => Routine) =>
    setRoutine((current) => (current ? touch(change(current)) : current))
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
    if (!sheet || !routine) return
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
  const flush = () => {
    try {
      saver.current.flush()
      setError(null)
    } catch (cause) {
      reportError(cause)
      throw cause
    }
  }
  const adopt = (next: RoutineCollection) => {
    const selected =
      next.routines.find((item) => item.routine.id === next.selectedRoutineId)?.routine ?? null
    saver.current.cancel()
    persistedReplacement.current = selected
    setRoutine(selected)
    setCollection(next)
    close()
  }
  const transition = (mutate: () => RoutineCollection): boolean => {
    try {
      flush()
      adopt(mutate())
      return true
    } catch (cause) {
      reportError(cause)
      return false
    }
  }
  const selectRoutine = (id: string) =>
    id === routine?.id ||
    transition(() => {
      const next = repository.loadCollection()
      const selected = repository.select(id)
      try {
        return repository.loadCollection()
      } catch (cause) {
        reportError(cause)
        return {
          ...next,
          selectedRoutineId: id,
          routines: next.routines.map((item) =>
            item.routine.id === id
              ? { routine: selected, lastAccessedAt: new Date().toISOString() }
              : item,
          ),
        }
      }
    })
  const createNewRoutine = () =>
    transition(() => {
      const names = new Set(
        repository.loadCollection().routines.map((item) => normalizeRoutineName(item.routine.name)),
      )
      let name = 'New routine'
      for (let number = 2; names.has(name); number++) name = `New routine ${number}`
      return repository.add(createBlankRoutine(name))
    })
  const createRandomRoutineFromWelcome = () =>
    transition(() => repository.add(createRandomRoutine()))
  const importRoutine = (imported: Routine) => transition(() => repository.add(imported))
  const deleteRoutine = (id: string) => transition(() => repository.remove(id))
  const refreshCollection = () => {
    try {
      setCollection(repository.loadCollection())
    } catch (cause) {
      reportError(cause)
    }
  }
  return {
    routine,
    sheet,
    submitted,
    total,
    validation,
    valid: validation?.valid ?? false,
    atEntryLimit: routine ? routine.entries.length >= ROUTINE_ENTRY_MAX_COUNT : false,
    setSheet,
    update,
    updateSetting,
    save,
    close,
    remove,
    reorder,
    error,
    routines: collection.routines.map((item) =>
      item.routine.id === routine?.id ? { ...item, routine } : item,
    ),
    atRoutineLimit: collection.routines.length >= ROUTINE_MAX_COUNT,
    selectRoutine,
    createNewRoutine,
    createRandomRoutine: createRandomRoutineFromWelcome,
    importRoutine,
    deleteRoutine,
    refreshCollection,
    flush,
  }
}
