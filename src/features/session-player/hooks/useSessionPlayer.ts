import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { practiceConfig, type MetronomeSound } from '../../../config/practice-config'
import type { Routine } from '../../../domain/routine'
import type { SessionStep } from '../../../domain/session'
import { AudioController } from '../../../services/audio'
import { WakeLockController } from '../../../services/platform/wakeLock'
import { observeVisibility } from '../../../services/platform/visibilityLifecycle'
import { SessionRunner } from '../../../services/session/SessionRunner'
import {
  activeSegmentKey,
  currentStep,
  initialSessionState,
  type SessionState,
} from '../../../services/session/sessionReducer'

function cueForCompleted(step: SessionStep): 'exercise-complete' | 'break-complete' {
  return step.kind === 'break' ? 'break-complete' : 'exercise-complete'
}
interface UseSessionPlayerOptions {
  routine: Routine
  audio?: AudioController
  onSaveTempo?(sourceExerciseId: string, tempoBpm: number): void
  onSaveMetronomeSound?(sound: MetronomeSound): void
  onSaveAlternateBeatTone?(alternateBeatTone: boolean): void
}
export function useSessionPlayer({
  routine,
  audio: suppliedAudio,
  onSaveTempo,
  onSaveMetronomeSound,
  onSaveAlternateBeatTone,
}: UseSessionPlayerOptions) {
  const [state, setState] = useState<SessionState>(initialSessionState)
  const [now, setNow] = useState(() => performance.now())
  const [tempoOverrides, setTempoOverrides] = useState<Record<string, number>>({})
  const [savedTempos, setSavedTempos] = useState<Record<string, number>>({})
  const [soundOverride, setSoundOverride] = useState<MetronomeSound>(routine.metronomeSound)
  const [alternateBeatTone, setAlternateBeatTone] = useState(routine.alternateBeatTone)
  const tempoOverridesRef = useRef<Record<string, number>>({})
  const soundOverrideRef = useRef<MetronomeSound>(routine.metronomeSound)
  const alternateBeatToneRef = useRef(routine.alternateBeatTone)
  const audio = useMemo(() => suppliedAudio ?? new AudioController(), [suppliedAudio])
  const beatSnapshot = useSyncExternalStore(audio.subscribeToBeats, audio.getBeatSnapshot)
  const audioState = useSyncExternalStore(audio.subscribeToState, audio.getStateSnapshot)
  const wakeLock = useMemo(() => new WakeLockController(), [])
  const runner = useRef<SessionRunner | null>(null)
  const reconciledAudioPhase = useRef<string | null>(null)

  const reconcileAudio = () => {
    if (audio.getStateSnapshot().status !== 'running') return
    const currentState = runner.current?.getState()
    if (!currentState || currentState.status !== 'running' || currentState.phase !== 'step') {
      audio.stopMetronome()
      return
    }
    const step = currentStep(currentState)
    if (!step || step.kind !== 'exercise' || step.tempoBpm === null) {
      audio.stopMetronome()
      return
    }
    const segmentKey = activeSegmentKey(currentState)
    if (!segmentKey) return
    const key = `${segmentKey}:${audio.getStateSnapshot().generation}`
    if (reconciledAudioPhase.current === key) return

    if (
      audio.startMetronome({
        bpm: tempoOverridesRef.current[step.sourceExerciseId] ?? step.tempoBpm,
        sound: soundOverrideRef.current,
        alternateBeatTone: alternateBeatToneRef.current,
      })
    ) {
      reconciledAudioPhase.current = key
      const warningDelayMs =
        currentState.currentStepEndsAt === null
          ? null
          : currentState.currentStepEndsAt - performance.now() - routine.warningLeadTimeSec * 1000
      if (
        warningDelayMs !== null &&
        warningDelayMs > 0 &&
        currentState.warningPlayedForStepId !== step.id &&
        routine.warningLeadTimeSec > 0
      )
        audio.scheduleWarningAt(warningDelayMs)
    }
  }
  useEffect(() => {
    runner.current = new SessionRunner(undefined, undefined, {
      onStateChange: setState,
      usesBeatClockForWarning: (step) => step.kind === 'exercise' && step.tempoBpm !== null,
      onStepStart: () => reconcileAudio(),
      onStepStop: (step, reason) => {
        audio.stopMetronome()
        if (reason === 'STEP_COMPLETED') audio.playCue(cueForCompleted(step))
      },
      onQuickRestStart: () => audio.stopMetronome(),
      onQuickRestStop: (_rest, reason) => {
        if (reason === 'STEP_COMPLETED') audio.playCue('break-complete')
      },
      onWarning: () => audio.playCue('warning'),
      onSessionComplete: () => audio.playCue('session-complete'),
    })
    const current = runner.current
    const unsubscribe = observeVisibility((visible) => {
      if (visible) {
        void wakeLock.acquire()
      } else current.appHidden()
    })
    return () => {
      unsubscribe()
      current.dispose()
      if (!suppliedAudio) audio.dispose()
      void wakeLock.release()
    }
  }, [audio, wakeLock])
  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 250)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    runner.current?.start(routine)
    void wakeLock.acquire()
  }, [routine, wakeLock])
  useEffect(() => {
    if (audioState.status === 'running') reconcileAudio()
    else reconciledAudioPhase.current = null
  }, [audioState.generation, audioState.status])
  const activateAudio = () => {
    reconciledAudioPhase.current = null
    void audio.ensureRunning().then((running) => {
      if (running) reconcileAudio()
    })
  }
  const changeTempo = (step: SessionStep, currentTempo: number, delta: number) => {
    if (step.kind !== 'exercise') return
    const value = Math.min(
      practiceConfig.tempo.max,
      Math.max(practiceConfig.tempo.min, currentTempo + delta),
    )
    tempoOverridesRef.current[step.sourceExerciseId] = value
    setTempoOverrides((values) => ({ ...values, [step.sourceExerciseId]: value }))
    audio.updateMetronomeTempo(value)
  }
  const saveTempo = (step: SessionStep, tempo: number) => {
    if (step.kind !== 'exercise') return
    onSaveTempo?.(step.sourceExerciseId, tempo)
    setSavedTempos((values) => ({ ...values, [step.sourceExerciseId]: tempo }))
  }
  const changeSound = (sound: MetronomeSound, playing: boolean) => {
    soundOverrideRef.current = sound
    setSoundOverride(sound)
    if (playing) audio.updateMetronomeSound(sound)
    onSaveMetronomeSound?.(sound)
  }
  const changeAlternateBeatTone = (enabled: boolean) => {
    alternateBeatToneRef.current = enabled
    setAlternateBeatTone(enabled)
    audio.updateAlternateBeatTone(enabled)
    onSaveAlternateBeatTone?.(enabled)
  }
  return {
    state,
    now,
    tempoOverrides,
    savedTempos,
    soundOverride,
    alternateBeatTone,
    beatSnapshot,
    audioState,
    changeTempo,
    saveTempo,
    changeSound,
    changeAlternateBeatTone,
    rewind: () => runner.current?.rewind(),
    activateAudio,
    togglePause: (paused: boolean) => {
      if (paused) {
        activateAudio()
        runner.current?.resume()
      } else runner.current?.pause()
    },
    finishOrSkip: (paused: boolean) => {
      if (paused) runner.current?.resume()
      runner.current?.skipStep()
    },
    stop: () => runner.current?.stop(),
  }
}
