import { useState } from "react";
import { BottomSheet, ProgressSegments } from "../../components";
import { practiceConfig, type MetronomeSound } from "../../config/practice-config";
import type { Routine } from "../../domain/routine";
import { EndScreen } from "./EndScreen";
import { NowPlayingSheet } from "./NowPlayingSheet";
import { SessionControls } from "./SessionControls";
import { SessionTimer } from "./SessionTimer";
import { StopSlider } from "./StopSlider";
import { stepMetadata } from "./stepMetadata";
import { useSessionPlayer } from "./useSessionPlayer";

export interface SessionPlayerProps {
  routine: Routine;
  onExit(): void;
  onSaveTempo?(sourceExerciseId: string, tempoBpm: number): void;
  onSaveMetronomeSound?(sound: MetronomeSound): void;
}

export function SessionPlayer({
  routine,
  onExit,
  onSaveTempo,
  onSaveMetronomeSound,
}: SessionPlayerProps) {
  const player = useSessionPlayer({ routine, onSaveTempo, onSaveMetronomeSound });
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
  const { state } = player;
  const step =
    state.currentStepIndex === null ? null : (state.steps[state.currentStepIndex] ?? null);
  const index = state.currentStepIndex ?? 0;
  const quickRest =
    state.phase === "quick-rest"
      ? (state.quickRests.find((rest) => rest.afterStepId === step?.id) ?? null)
      : null;
  const nextStep = state.steps[index + 1] ?? null;
  const remainingSec =
    state.currentStepEndsAt === null
      ? null
      : Math.max(0, Math.ceil((state.currentStepEndsAt - player.now) / 1000));
  const elapsedSec =
    (state.status === "paused" || state.status === "interrupted") && state.pausedElapsedSec !== null
      ? Math.floor(state.pausedElapsedSec)
      : state.currentStepStartedAt === null
        ? 0
        : Math.max(0, Math.floor((player.now - state.currentStepStartedAt) / 1000));
  if (state.status === "completed")
    return (
      <EndScreen
        title="Routine complete"
        copy="Nice work — every step is finished."
        onExit={onExit}
      />
    );
  if (state.status === "stopped")
    return (
      <EndScreen
        title="Session stopped"
        copy="Your progress for this session has ended."
        onExit={onExit}
      />
    );
  if (!step) return null;
  const paused = state.status === "paused" || state.status === "interrupted";
  const displaySeconds =
    paused && state.pausedRemainingSec !== null
      ? Math.ceil(state.pausedRemainingSec)
      : remainingSec;
  const isQuickRest = state.phase === "quick-rest";
  const isExercise = !isQuickRest && step.kind === "exercise";
  const isBreak = !isQuickRest && step.kind === "break";
  const currentTempo =
    isExercise && step.tempoBpm !== null
      ? (player.tempoOverrides[step.sourceExerciseId] ?? step.tempoBpm)
      : null;
  const savedTempo =
    isExercise && step.tempoBpm !== null
      ? (player.savedTempos[step.sourceExerciseId] ?? step.tempoBpm)
      : null;
  const duration = isQuickRest ? (quickRest?.durationSec ?? null) : step.durationSec;
  const progress =
    duration === null || displaySeconds === null
      ? null
      : Math.min(1, Math.max(0, (duration - displaySeconds) / duration));
  const title = isQuickRest ? "Quick Rest" : isBreak ? "Break" : step.title;
  const tone = isQuickRest ? "quick-rest" : isBreak ? "break" : "exercise";
  return (
    <main className={`session-player ${tone}-session`} aria-live="polite">
      <header className="session-header">
        <button
          className="now-playing-trigger"
          onClick={() => setNowPlayingOpen(true)}
          aria-haspopup="dialog"
        >
          <span className="eyebrow">NOW PLAYING</span>
          <span>{routine.name}</span>
        </button>
      </header>
      <ProgressSegments
        count={state.steps.length}
        current={index}
        tone={tone}
        label="Session progress"
      />
      <section className="session-heading">
        <h1>{title}</h1>
        {nextStep && <p className="next-step">Up next: {stepMetadata(nextStep)}</p>}
      </section>
      <SessionTimer
        tempo={currentTempo}
        savedTempo={savedTempo}
        isBreak={isBreak}
        isQuickRest={isQuickRest}
        displaySeconds={displaySeconds}
        elapsedSeconds={elapsedSec}
        progress={progress}
        tone={tone}
        onChangeTempo={(delta) =>
          currentTempo !== null && player.changeTempo(step, currentTempo, delta)
        }
        onSaveTempo={() => currentTempo !== null && player.saveTempo(step, currentTempo)}
      />
      {isExercise && currentTempo !== null && (
        <>
          <div className="metronome-sound-control">
            <label>
              <span>Metronome sound</span>
              <select
                value={player.soundOverride}
                onChange={(event) => player.changeSound(event.target.value as MetronomeSound, true)}
              >
                {Object.keys(practiceConfig.metronome.sounds).map((sound) => (
                  <option key={sound} value={sound}>
                    {sound[0]!.toUpperCase() + sound.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            {player.soundOverride !== player.savedSound && (
              <button onClick={player.saveSound}>Save sound</button>
            )}
          </div>
          <div className="beat-indicator" aria-label="Metronome beat">
            {[0, 1, 2, 3].map((dot) => (
              <span key={dot} className={dot === player.beat && !paused ? "active" : ""} />
            ))}
          </div>
        </>
      )}
      {!player.audioAvailable && (
        <p role="status" className="session-banner">
          Audio is unavailable. Timers and controls still work.
        </p>
      )}
      {state.status === "interrupted" && (
        <p role="alert" className="session-banner">
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
      {nowPlayingOpen && (
        <NowPlayingSheet
          steps={state.steps}
          currentIndex={index}
          quickRest={isQuickRest}
          onClose={() => setNowPlayingOpen(false)}
        />
      )}
      {stopOpen && (
        <BottomSheet title="Stop session" onClose={() => setStopOpen(false)}>
          <StopSlider
            onStop={() => {
              setStopOpen(false);
              player.stop();
            }}
          />
        </BottomSheet>
      )}
    </main>
  );
}
