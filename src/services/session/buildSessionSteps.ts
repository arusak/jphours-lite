import type { Routine } from '../../domain/routine'
import type { ExerciseStep, SessionPlan, SessionStep } from '../../domain/session'

/**
 * Captures the routine's ordered entries at session start. Quick Rests stay
 * outside `steps`: they are transition metadata after directly adjacent
 * exercises, so progress and Now Playing only contain meaningful entries.
 */
export function buildSessionPlan(routine: Routine): SessionPlan {
  if (routine.entries.length === 0)
    throw new Error('A routine needs at least one entry to start a session.')

  const steps: SessionStep[] = []
  const quickRests: SessionPlan['quickRests'] = []
  routine.entries.forEach((entry, index) => {
    if (entry.kind === 'break') {
      steps.push({
        id: `break:${entry.id}`,
        kind: 'break',
        title: 'Break',
        durationSec: entry.durationSec,
      })
      return
    }
    const step: ExerciseStep = {
      id: `exercise:${entry.id}`,
      kind: 'exercise',
      sourceExerciseId: entry.id,
      title: entry.title.trim(),
      tempoBpm: entry.tempoBpm,
      durationSec: entry.durationSec,
    }
    steps.push(step)
    const next = routine.entries[index + 1]
    if (next?.kind === 'exercise' && routine.quickRestDurationSec > 0) {
      quickRests.push({
        id: `quick-rest:${entry.id}`,
        afterStepId: step.id,
        durationSec: routine.quickRestDurationSec,
      })
    }
  })
  return { steps, quickRests }
}
