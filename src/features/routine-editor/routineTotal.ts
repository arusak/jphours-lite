import { practiceConfig } from '../../config/practice-config'
import type { Routine } from '../../domain/routine'

const minute = 60

export function routineTotal(routine: Routine): { minutes: number; approximate: boolean } {
  let seconds = 0
  let approximate = false
  routine.entries.forEach((entry, index) => {
    if (entry.kind === 'exercise' && entry.durationSec === null) {
      seconds += practiceConfig.exerciseDuration.default
      approximate = true
    } else if (entry.durationSec !== null) seconds += entry.durationSec
    if (entry.kind === 'exercise' && routine.entries[index + 1]?.kind === 'exercise')
      seconds += routine.quickRestDurationSec
  })
  return { minutes: Math.ceil(seconds / minute), approximate }
}
