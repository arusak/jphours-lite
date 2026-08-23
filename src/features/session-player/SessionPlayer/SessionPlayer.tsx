import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BottomSheet,
  MetronomeIcon,
  MetronomeSoundSheet,
  ProgressSegments,
} from '../../../components'
import { type MetronomeSound } from '../../../config/practice-config'
import type { Routine } from '../../../domain/routine'
import type { AudioController } from '../../../services/audio'
import { EndScreen } from '../EndScreen/EndScreen'
import { NowPlayingSheet } from '../NowPlayingSheet/NowPlayingSheet'
import { SessionControls } from '../SessionControls/SessionControls'
import { SessionTimer } from '../SessionTimer/SessionTimer'
import { StopSlider } from '../StopSlider/StopSlider'
import { stepMetadata } from '../stepMetadata'
import { useSessionPlayer } from '../hooks/useSessionPlayer'
import styles from '../SessionPlayer.module.css'

export interface SessionPlayerProps {
  routine: Routine
  onExit(): void
  audio?: AudioController
  onSaveTempo?(sourceExerciseId: string, tempoBpm: number): void
  onSaveMetronomeSound?(sound: MetronomeSound): void
  onSaveAlternateBeatTone?(alternateBeatTone: boolean): void
}

export function SessionPlayer({
  routine,
  onExit,
  audio,
  onSaveTempo,
  onSaveMetronomeSound,
  onSaveAlternateBeatTone,
}: SessionPlayerProps) {
  const player = useSessionPlayer({
    routine,
    audio,
    onSaveTempo,
    onSaveMetronomeSound,
    onSaveAlternateBeatTone,
  })
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false)
  const [stopOpen, setStopOpen] = useState(false)
  const [stopPendingExit, setStopPendingExit] = useState(false)
  const [soundPickerOpen, setSoundPickerOpen] = useState(false)
  const [completionScreenVisible, setCompletionScreenVisible] = useState(false)
  const lastPacedTimer = useRef<{
    tempo: number
    savedTempo: number
    displaySeconds: number | null
    elapsedSeconds: number
    tone: 'exercise'
  } | null>(null)
  const { state } = player
  const step =
    state.currentStepIndex === null ? null : (state.steps[state.currentStepIndex] ?? null)
  const index = state.currentStepIndex ?? 0
  const quickRest =
    state.phase === 'quick-rest'
      ? (state.quickRests.find((rest) => rest.afterStepId === step?.id) ?? null)
      : null
  const durationForRing =
    state.phase === 'quick-rest' ? (quickRest?.durationSec ?? null) : (step?.durationSec ?? null)
  const pacedRing = state.phase === 'step' && step?.kind === 'exercise' && step.tempoBpm !== null
  const beatProgress = useMemo(() => {
    if (
      !pacedRing ||
      durationForRing === null ||
      state.currentStepStartedAt === null ||
      state.status === 'paused' ||
      state.status === 'interrupted'
    )
      return null
    return Math.min(
      1,
      Math.max(0, (performance.now() - state.currentStepStartedAt) / 1000 / durationForRing),
    )
  }, [
    pacedRing,
    durationForRing,
    state.currentStepStartedAt,
    state.status,
    player.beatSnapshot.generation,
    player.beatSnapshot.beatIndex,
  ])
  const nextStep = state.steps[index + 1] ?? null
  const remainingSec =
    state.currentStepEndsAt === null
      ? null
      : Math.max(0, Math.ceil((state.currentStepEndsAt - player.now) / 1000))
  const elapsedSec =
    (state.status === 'paused' || state.status === 'interrupted') && state.pausedElapsedSec !== null
      ? Math.floor(state.pausedElapsedSec)
      : state.currentStepStartedAt === null
        ? 0
        : Math.max(0, Math.floor((player.now - state.currentStepStartedAt) / 1000))
  useEffect(() => {
    if (state.status !== 'completed') {
      setCompletionScreenVisible(false)
      return
    }
    if (!lastPacedTimer.current) return
    const frame = window.requestAnimationFrame(() => setCompletionScreenVisible(true))
    return () => window.cancelAnimationFrame(frame)
  }, [state.status])
  if (state.status === 'completed' && lastPacedTimer.current && !completionScreenVisible) {
    const timer = lastPacedTimer.current
    return (
      <main className={styles.sessionPlayer} aria-live="polite">
        <SessionTimer
          {...timer}
          isBreak={false}
          isQuickRest={false}
          progress={1}
          discreteProgress
          onChangeTempo={() => undefined}
          onSaveTempo={() => undefined}
        />
      </main>
    )
  }
  if (state.status === 'completed')
    return (
      <EndScreen
        title="Routine complete"
        copy="Nice work — every step is finished."
        onExit={onExit}
      />
    )
  if (!step)
    return (
      <main className={styles.sessionPlayer}>
        <BottomSheet
          key="stop-sheet"
          open={stopOpen}
          title="Stop session"
          onClose={() => setStopOpen(false)}
          onAfterClose={() => stopPendingExit && onExit()}
        >
          <StopSlider
            onStop={() => {
              setStopOpen(false)
              setStopPendingExit(true)
              player.stop()
            }}
          />
        </BottomSheet>
      </main>
    )
  const paused = state.status === 'paused' || state.status === 'interrupted'
  const displaySeconds =
    paused && state.pausedRemainingSec !== null ? Math.ceil(state.pausedRemainingSec) : remainingSec
  const isQuickRest = state.phase === 'quick-rest'
  const isExercise = !isQuickRest && step.kind === 'exercise'
  const isBreak = !isQuickRest && step.kind === 'break'
  const currentTempo =
    isExercise && step.tempoBpm !== null
      ? (player.tempoOverrides[step.sourceExerciseId] ?? step.tempoBpm)
      : null
  const savedTempo =
    isExercise && step.tempoBpm !== null
      ? (player.savedTempos[step.sourceExerciseId] ?? step.tempoBpm)
      : null
  const duration = isQuickRest ? (quickRest?.durationSec ?? null) : step.durationSec
  const countdownProgress =
    duration === null || displaySeconds === null
      ? null
      : Math.min(1, Math.max(0, (duration - displaySeconds) / duration))
  const progress = pacedRing ? beatProgress : countdownProgress
  const title = isQuickRest ? 'Quick Rest' : isBreak ? 'Break' : step.title
  const tone = isQuickRest ? 'quick-rest' : isBreak ? 'break' : 'exercise'
  if (pacedRing && currentTempo !== null && savedTempo !== null)
    lastPacedTimer.current = {
      tempo: currentTempo,
      savedTempo,
      displaySeconds,
      elapsedSeconds: elapsedSec,
      tone: 'exercise',
    }
  return (
    <main className={styles.sessionPlayer} aria-live="polite">
      <header className={styles.sessionHeader}>
        <button
          className={styles.nowPlayingTrigger}
          onClick={() => setNowPlayingOpen(true)}
          aria-haspopup="dialog"
        >
          <span className={styles.eyebrow}>NOW PLAYING</span>
          <span>{routine.name}</span>
        </button>
        {isExercise && currentTempo !== null && (
          <button
            className={styles.metronomeSoundTrigger}
            onClick={() => setSoundPickerOpen(true)}
            aria-label="Choose metronome sound"
            aria-haspopup="dialog"
          >
            <MetronomeIcon />
          </button>
        )}
      </header>
      <ProgressSegments
        count={state.steps.length}
        current={index}
        tone={tone}
        label="Session progress"
      />
      <section className={styles.sessionHeading}>
        <h1>{title}</h1>
        {nextStep && <p className={styles.nextStep}>Up next: {stepMetadata(nextStep)}</p>}
      </section>
      <SessionTimer
        tempo={currentTempo}
        savedTempo={savedTempo}
        isBreak={isBreak}
        isQuickRest={isQuickRest}
        displaySeconds={displaySeconds}
        elapsedSeconds={elapsedSec}
        progress={progress}
        discreteProgress={pacedRing}
        tone={tone}
        onChangeTempo={(delta) =>
          currentTempo !== null && player.changeTempo(step, currentTempo, delta)
        }
        onSaveTempo={() => currentTempo !== null && player.saveTempo(step, currentTempo)}
      />
      {isExercise && currentTempo !== null && (
        <>
          <div className={styles.beatIndicator} aria-label="Metronome beat">
            {[0, 1, 2, 3].map((dot) => (
              <span
                key={dot}
                className={
                  dot === player.beatSnapshot.positionInPattern &&
                  !paused &&
                  player.beatSnapshot.running
                    ? styles.active
                    : ''
                }
              />
            ))}
          </div>
        </>
      )}
      {player.audioState.status === 'activating' && (
        <p role="status" className={styles.sessionBanner}>
          Starting audio… Timers and controls still work.
        </p>
      )}
      {player.audioState.status === 'unavailable' && (
        <div role="status" className={styles.sessionBanner}>
          <span>Audio is unavailable. Timers and controls still work.</span>
          <button type="button" onClick={player.activateAudio}>
            Retry audio
          </button>
        </div>
      )}
      {state.status === 'interrupted' && (
        <p role="alert" className={styles.sessionBanner}>
          Session paused while the app was in the background.
        </p>
      )}
      <SessionControls
        paused={paused}
        quickRest={isQuickRest}
        onRewind={player.rewind}
        onPauseResume={() => player.togglePause(paused)}
        onStop={() => setStopOpen(true)}
        onFinishOrSkip={() => player.finishOrSkip(paused)}
      />
      <NowPlayingSheet
        open={nowPlayingOpen}
        steps={state.steps}
        currentIndex={index}
        quickRest={isQuickRest}
        onClose={() => setNowPlayingOpen(false)}
      />
      <MetronomeSoundSheet
        open={soundPickerOpen}
        sound={player.soundOverride}
        onChange={(sound) => player.changeSound(sound, true)}
        alternateBeatTone={player.alternateBeatTone}
        onAlternateBeatToneChange={player.changeAlternateBeatTone}
        onClose={() => setSoundPickerOpen(false)}
      />
      <BottomSheet
        key="stop-sheet"
        open={stopOpen}
        title="Stop session"
        onClose={() => setStopOpen(false)}
        onAfterClose={() => stopPendingExit && onExit()}
      >
        <StopSlider
          onStop={() => {
            setStopOpen(false)
            player.stop()
            setStopPendingExit(true)
          }}
        />
      </BottomSheet>
    </main>
  )
}
