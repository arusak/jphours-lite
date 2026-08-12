import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import type { Routine } from '../../../domain/routine'
import {
  parseRoutineFileText,
  routineFileName,
  ROUTINE_FILE_MAX_BYTES,
  serializeRoutineFile,
} from '../../../services/routine-files/routine-file'
import { routineTotal } from '../routineTotal'

interface UseRoutineFileActionsOptions {
  routine: Routine
  onImport(routine: Routine): void
}

export function useRoutineFileActions({ routine, onImport }: UseRoutineFileActionsOptions) {
  const input = useRef<HTMLInputElement>(null)
  const importRequest = useRef(0)
  const [preview, setPreview] = useState<Routine | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const previewDetails = useMemo(() => {
    if (!preview) return null
    const exerciseNames = preview.entries
      .filter((entry) => entry.kind === 'exercise')
      .map((entry) => entry.title)
    const visibleExerciseNames = exerciseNames.slice(0, 20)
    return {
      total: routineTotal(preview),
      visibleExerciseNames,
      hiddenExerciseCount: exerciseNames.length - visibleExerciseNames.length,
    }
  }, [preview])

  const chooseImportFile = () => input.current?.click()

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const request = ++importRequest.current
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setStatus(null)
    if (file.size > ROUTINE_FILE_MAX_BYTES) {
      console.warn('Routine import validation failed', {
        issues: [{ path: '', code: 'file_too_large' }],
      })
      setStatus('This is not a supported JP Hours Routine file.')
      return
    }

    let text: string
    try {
      text = await file.text()
    } catch (error) {
      if (request !== importRequest.current) return
      console.warn('Routine import file could not be read', {
        error: error instanceof Error ? error.name : 'unknown',
      })
      setStatus('The selected Routine file could not be read.')
      return
    }

    if (request !== importRequest.current) return

    const result = parseRoutineFileText(text)
    if (!result.success) {
      setStatus(result.message)
      return
    }
    setPreview(result.routine)
  }

  const exportRoutine = () => {
    const url = URL.createObjectURL(
      new Blob([serializeRoutineFile(routine)], { type: 'application/json' }),
    )
    try {
      const link = document.createElement('a')
      link.href = url
      link.download = routineFileName(routine.name)
      link.click()
      setStatus('Routine exported.')
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  const confirmImport = () => {
    if (!preview) return
    try {
      onImport(preview)
      setPreview(null)
      setStatus('Routine imported.')
    } catch (error) {
      console.warn('Routine import could not be saved', {
        error: error instanceof Error ? error.name : 'unknown',
      })
      setStatus('The Routine could not be saved. Your current Routine was kept.')
    }
  }

  return {
    input,
    preview,
    previewDetails,
    status,
    chooseImportFile,
    importFile,
    exportRoutine,
    confirmImport,
    cancelImport: () => setPreview(null),
  }
}
