import type { SessionStep } from '../../domain/session'
import { formatTime } from './formatTime'

export function stepMetadata(step: SessionStep): {
  title: string
  tempoBpm: number | null
  duration: string | null
} {
  return {
    title: step.kind === 'break' ? 'Break' : step.title,
    tempoBpm: step.kind === 'exercise' ? step.tempoBpm : null,
    duration: step.durationSec === null ? null : formatTime(step.durationSec),
  }
}
