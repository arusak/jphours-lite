import type { QuickRestTransition, SessionPlan, SessionStep } from '../../domain/session'
import { isTimedStep } from '../../domain/session'
import type { Routine } from '../../domain/routine'
import { buildSessionPlan } from './buildSessionSteps'

export type SessionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'stopped' | 'interrupted'
export type SessionPhase = 'step' | 'quick-rest'

export interface SessionState {
  status: SessionStatus
  steps: SessionStep[]
  quickRests: QuickRestTransition[]
  currentStepIndex: number | null
  phase: SessionPhase
  currentStepStartedAt: number | null
  currentStepEndsAt: number | null
  pausedRemainingSec: number | null
  pausedElapsedSec: number | null
  warningPlayedForStepId: string | null
}

export type SessionCommand =
  | { type: 'START'; routine: Routine; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'SKIP_STEP'; now: number }
  | { type: 'REWIND'; now: number }
  | { type: 'STOP' }
  | { type: 'STEP_WARNING'; stepId: string }
  | { type: 'STEP_COMPLETED'; stepId: string; now: number }
  | { type: 'APP_HIDDEN'; now: number }

export const initialSessionState: SessionState = {
  status: 'idle',
  steps: [],
  quickRests: [],
  currentStepIndex: null,
  phase: 'step',
  currentStepStartedAt: null,
  currentStepEndsAt: null,
  pausedRemainingSec: null,
  pausedElapsedSec: null,
  warningPlayedForStepId: null,
}

export function sessionReducer(state: SessionState, command: SessionCommand): SessionState {
  switch (command.type) {
    case 'START':
      return enterStep(buildSessionPlan(command.routine), 0, command.now)
    case 'PAUSE':
    case 'APP_HIDDEN':
      return pause(state, command.now, command.type === 'APP_HIDDEN' ? 'interrupted' : 'paused')
    case 'RESUME':
      return resume(state, command.now)
    case 'SKIP_STEP':
      return state.status === 'running' ? advance(state, command.now) : state
    case 'REWIND':
      return rewind(state, command.now)
    case 'STEP_WARNING':
      return canEmitForCurrentTimedStep(state, command.stepId) &&
        state.warningPlayedForStepId !== command.stepId
        ? { ...state, warningPlayedForStepId: command.stepId }
        : state
    case 'STEP_COMPLETED':
      return canCompleteActiveSegment(state, command.stepId) ? advance(state, command.now) : state
    case 'STOP':
      return state.status === 'idle' ? state : { ...initialSessionState, status: 'stopped' }
  }
}

export function currentStep(state: SessionState): SessionStep | null {
  return state.currentStepIndex === null ? null : (state.steps[state.currentStepIndex] ?? null)
}

export function currentQuickRest(state: SessionState): QuickRestTransition | null {
  if (state.phase !== 'quick-rest') return null
  const step = currentStep(state)
  return step ? (state.quickRests.find((rest) => rest.afterStepId === step.id) ?? null) : null
}

/** Stable id for timers, used to reject callbacks from replaced transitions. */
export function activeSegmentId(state: SessionState): string | null {
  return state.phase === 'quick-rest'
    ? (currentQuickRest(state)?.id ?? null)
    : (currentStep(state)?.id ?? null)
}

/** Includes the start instant so a rewind of the same step replaces its timers. */
export function activeSegmentKey(state: SessionState): string | null {
  const id = activeSegmentId(state)
  return id === null || state.currentStepStartedAt === null
    ? null
    : `${id}:${state.currentStepStartedAt}`
}

function rewind(state: SessionState, now: number): SessionState {
  if (state.status !== 'running' || state.currentStepIndex === null) return state
  return enterStep(
    { steps: state.steps, quickRests: state.quickRests },
    state.currentStepIndex,
    now,
  )
}

function pause(state: SessionState, now: number, status: 'paused' | 'interrupted'): SessionState {
  if (state.status !== 'running') return state
  const activeDuration =
    state.phase === 'quick-rest'
      ? (currentQuickRest(state)?.durationSec ?? null)
      : stepDuration(currentStep(state))
  const remainingSec =
    activeDuration !== null && state.currentStepEndsAt !== null
      ? Math.max(0, (state.currentStepEndsAt - now) / 1000)
      : null
  return {
    ...state,
    status,
    currentStepEndsAt: null,
    pausedRemainingSec: remainingSec,
    pausedElapsedSec:
      state.currentStepStartedAt === null
        ? 0
        : Math.max(0, (now - state.currentStepStartedAt) / 1000),
  }
}

function resume(state: SessionState, now: number): SessionState {
  if (state.status !== 'paused' && state.status !== 'interrupted') return state
  const duration =
    state.phase === 'quick-rest'
      ? (currentQuickRest(state)?.durationSec ?? null)
      : stepDuration(currentStep(state))
  if (state.currentStepIndex === null) return state
  const remainingSec = duration === null ? null : (state.pausedRemainingSec ?? duration)
  return {
    ...state,
    status: 'running',
    currentStepStartedAt: now - (state.pausedElapsedSec ?? 0) * 1000,
    currentStepEndsAt: remainingSec === null ? null : now + remainingSec * 1000,
    pausedRemainingSec: null,
    pausedElapsedSec: null,
  }
}

function advance(state: SessionState, now: number): SessionState {
  if (state.phase === 'quick-rest') return advanceToNextStep(state, now)
  const step = currentStep(state)
  const rest = step
    ? state.quickRests.find((candidate) => candidate.afterStepId === step.id)
    : undefined
  return rest ? enterQuickRest(state, rest, now) : advanceToNextStep(state, now)
}

function advanceToNextStep(state: SessionState, now: number): SessionState {
  const nextIndex = (state.currentStepIndex ?? -1) + 1
  return nextIndex < state.steps.length
    ? enterStep({ steps: state.steps, quickRests: state.quickRests }, nextIndex, now)
    : {
        ...initialSessionState,
        steps: state.steps,
        quickRests: state.quickRests,
        status: 'completed',
      }
}

function enterStep(plan: SessionPlan, index: number, now: number): SessionState {
  const step = plan.steps[index]
  const durationSec = stepDuration(step)
  return {
    status: 'running',
    steps: plan.steps,
    quickRests: plan.quickRests,
    currentStepIndex: index,
    phase: 'step',
    currentStepStartedAt: now,
    currentStepEndsAt: durationSec === null ? null : now + durationSec * 1000,
    pausedRemainingSec: null,
    pausedElapsedSec: null,
    warningPlayedForStepId: null,
  }
}

function enterQuickRest(state: SessionState, rest: QuickRestTransition, now: number): SessionState {
  return {
    ...state,
    phase: 'quick-rest',
    currentStepStartedAt: now,
    currentStepEndsAt: now + rest.durationSec * 1000,
    pausedRemainingSec: null,
    pausedElapsedSec: null,
    warningPlayedForStepId: null,
  }
}

function stepDuration(step: SessionStep | null): number | null {
  return step && isTimedStep(step) ? step.durationSec : null
}

function canEmitForCurrentTimedStep(state: SessionState, stepId: string): boolean {
  return (
    state.status === 'running' &&
    state.phase === 'step' &&
    currentStep(state)?.id === stepId &&
    isTimedStep(currentStep(state)!)
  )
}

function canCompleteActiveSegment(state: SessionState, stepId: string): boolean {
  return (
    state.status === 'running' &&
    activeSegmentId(state) === stepId &&
    (state.phase === 'quick-rest' || isTimedStep(currentStep(state)!))
  )
}
