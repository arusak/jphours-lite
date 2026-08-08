import type { ExerciseMode } from './routine'

export type { ExerciseMode } from './routine'

export interface ExerciseStep {
  id: string
  kind: 'exercise'
  sourceExerciseId: string
  title: string
  mode: ExerciseMode
  tempoBpm: number | null
  durationSec: number | null
}

export interface BreakStep {
  id: string
  kind: 'break'
  sourceBreakId: string
  title: 'Break'
  durationSec: number
}

export type SessionStep = ExerciseStep | BreakStep

/** A timed transition between adjacent exercise steps. It is deliberately not a SessionStep. */
export interface QuickRestTransition {
  id: string
  afterStepId: string
  durationSec: number
}

export interface SessionPlan {
  steps: SessionStep[]
  quickRests: QuickRestTransition[]
}

export function isTimedStep(step: SessionStep): boolean {
  return step.kind === 'break' || step.durationSec !== null
}

export function stepDurationSec(step: SessionStep): number | null {
  return step.kind === 'break' ? step.durationSec : step.durationSec
}
