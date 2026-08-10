import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { practiceConfig, type MetronomeSound } from '../../../config/practice-config'
import type { Routine } from '../../../domain/routine'
import type { SessionStep } from '../../../domain/session'
import { AudioController } from '../../../services/audio'
import { WakeLockController } from '../../../services/platform/wakeLock'
import { observeVisibility } from '../../../services/platform/visibilityLifecycle'
import { SessionRunner } from '../../../services/session/SessionRunner'
import { initialSessionState, type SessionState } from '../../../services/session/sessionReducer'

function cueForCompleted(step: SessionStep): 'exercise-complete' | 'break-complete' {
  return step.kind === 'break' ? 'break-complete' : 'exercise-complete'
}
interface UseSessionPlayerOptions {
  routine: Routine
  onSaveTempo?(sourceExerciseId: string, tempoBpm: number): void
  onSaveMetronomeSound?(sound: MetronomeSound): void
  onSaveAlternateBeatTone?(alternateBeatTone: boolean): void
}
export function useSessionPlayer({
  routine,
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
  const [audioAvailable, setAudioAvailable] = useState(true)
  const tempoOverridesRef = useRef<Record<string, number>>({})
  const soundOverrideRef = useRef<MetronomeSound>(routine.metronomeSound)
  const alternateBeatToneRef = useRef(routine.alternateBeatTone)
  const audio = useMemo(() => new AudioController(), [])
  const beatSnapshot = useSyncExternalStore(audio.subscribeToBeats, audio.getBeatSnapshot)
  const wakeLock = useMemo(() => new WakeLockController(), [])
  const runner = useRef<SessionRunner | null>(null)
  useEffect(() => {
    runner.current = new SessionRunner(undefined, undefined, {
      onStateChange: setState,
      usesBeatClockForWarning: (step) => step.kind === 'exercise' && step.tempoBpm !== null,
      onStepStart: (step, phaseState) => {
        if (step.kind === 'exercise' && step.tempoBpm !== null) {
          audio.startMetronome({
            bpm: tempoOverridesRef.current[step.sourceExerciseId] ?? step.tempoBpm,
            sound: soundOverrideRef.current,
            alternateBeatTone: alternateBeatToneRef.current,
          })
          if (
            step.durationSec !== null &&
            step.durationSec > routine.warningLeadTimeSec &&
            routine.warningLeadTimeSec > 0 &&
            phaseState.currentStepEndsAt !== null
          )
            audio.scheduleWarningAt(
              phaseState.currentStepEndsAt - performance.now() - routine.warningLeadTimeSec * 1000,
            )
        }
      },
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
        current.appVisible()
        void wakeLock.acquire()
      } else current.appHidden()
    })
    return () => {
      unsubscribe()
      current.dispose()
      audio.dispose()
      void wakeLock.release()
    }
  }, [audio, wakeLock])
  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 250)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    void audio
      .unlock()
      .then(setAudioAvailable)
      .finally(() => {
        runner.current?.start(routine)
        void wakeLock.acquire()
      })
  }, [audio, routine, wakeLock])
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
    audioAvailable,
    changeTempo,
    saveTempo,
    changeSound,
    changeAlternateBeatTone,
    rewind: () => runner.current?.rewind(),
    togglePause: (paused: boolean) => (paused ? runner.current?.resume() : runner.current?.pause()),
    finishOrSkip: (paused: boolean) => {
      if (paused) runner.current?.resume()
      runner.current?.skipStep()
    },
    stop: () => runner.current?.stop(),
  }
}
