import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BottomSheet, ProgressSegments, TimerRing } from "../../components";
import { practiceConfig, type MetronomeSound } from "../../config/practice-config";
import type { Routine } from "../../domain/routine";
import type { SessionStep } from "../../domain/session";
import { AudioController } from "../../services/audio";
import { WakeLockController } from "../../services/platform/wakeLock";
import { observeVisibility } from "../../services/platform/visibilityLifecycle";
import { SessionRunner } from "../../services/session/SessionRunner";
import { initialSessionState, type SessionState } from "../../services/session/sessionReducer";
import { SessionIllustration } from "./SessionIllustration";

export interface SessionPlayerProps {
  routine: Routine;
  onExit(): void;
  onSaveTempo?(sourceExerciseId: string, tempoBpm: number): void;
  onSaveMetronomeSound?(sound: MetronomeSound): void;
}

function cueForCompleted(step: SessionStep): "exercise-complete" | "break-complete" {
  return step.kind === "break" ? "break-complete" : "exercise-complete";
}

export function SessionPlayer({
  routine,
  onExit,
  onSaveTempo,
  onSaveMetronomeSound,
}: SessionPlayerProps) {
  const [state, setState] = useState<SessionState>(initialSessionState);
  const [now, setNow] = useState(() => performance.now());
  const [tempoOverrides, setTempoOverrides] = useState<Record<string, number>>({});
  const [savedTempos, setSavedTempos] = useState<Record<string, number>>({});
  const [soundOverride, setSoundOverride] = useState<MetronomeSound>(routine.metronomeSound);
  const [savedSound, setSavedSound] = useState<MetronomeSound>(routine.metronomeSound);
  const [beat, setBeat] = useState(0);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
  const tempoOverridesRef = useRef<Record<string, number>>({});
  const soundOverrideRef = useRef<MetronomeSound>(routine.metronomeSound);
  const audio = useMemo(() => new AudioController(), []);
  const wakeLock = useMemo(() => new WakeLockController(), []);
  const runner = useRef<SessionRunner | null>(null);

  useEffect(() => {
    runner.current = new SessionRunner(undefined, undefined, {
      onStateChange: setState,
      onStepStart: (nextStep) => {
        if (nextStep.kind === "exercise" && nextStep.tempoBpm !== null) {
          const bpm = tempoOverridesRef.current[nextStep.sourceExerciseId] ?? nextStep.tempoBpm;
          audio.startMetronome({
            bpm,
            sound: soundOverrideRef.current,
            onBeatScheduled: ({ beat: nextBeat }) => setBeat(nextBeat % 4),
          });
        }
      },
      onStepStop: (stoppedStep, reason) => {
        audio.stopMetronome();
        if (reason === "STEP_COMPLETED") audio.playCue(cueForCompleted(stoppedStep));
      },
      onQuickRestStart: () => audio.stopMetronome(),
      onQuickRestStop: (_rest, reason) => {
        if (reason === "STEP_COMPLETED") audio.playCue("break-complete");
      },
      onWarning: () => audio.playCue("warning"),
      onSessionComplete: () => audio.playCue("session-complete"),
    });
    const currentRunner = runner.current;
    const unsubscribe = observeVisibility((visible) => {
      if (visible) {
        currentRunner.appVisible();
        void wakeLock.acquire();
      } else currentRunner.appHidden();
    });
    return () => {
      unsubscribe();
      currentRunner.dispose();
      audio.dispose();
      void wakeLock.release();
    };
  }, [audio, wakeLock]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    void audio
      .unlock()
      .then(setAudioAvailable)
      .finally(() => {
        runner.current?.start(routine);
        void wakeLock.acquire();
      });
  }, [audio, routine, wakeLock]);

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
      : Math.max(0, Math.ceil((state.currentStepEndsAt - now) / 1000));
  const elapsedSec =
    (state.status === "paused" || state.status === "interrupted") && state.pausedElapsedSec !== null
      ? Math.floor(state.pausedElapsedSec)
      : state.currentStepStartedAt === null
        ? 0
        : Math.max(0, Math.floor((now - state.currentStepStartedAt) / 1000));

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
      ? (tempoOverrides[step.sourceExerciseId] ?? step.tempoBpm)
      : null;
  const savedTempo =
    isExercise && step.tempoBpm !== null
      ? (savedTempos[step.sourceExerciseId] ?? step.tempoBpm)
      : null;
  const duration = isQuickRest ? (quickRest?.durationSec ?? null) : step.durationSec;
  const progress =
    duration === null || displaySeconds === null
      ? null
      : Math.min(1, Math.max(0, (duration - displaySeconds) / duration));
  const title = isQuickRest ? "Quick Rest" : isBreak ? "Break" : step.title;
  const ringTone = isQuickRest ? "quick-rest" : isBreak ? "break" : "exercise";

  const changeTempo = (delta: number) => {
    if (!isExercise || currentTempo === null) return;
    const value = Math.min(
      practiceConfig.tempo.max,
      Math.max(practiceConfig.tempo.min, currentTempo + delta),
    );
    tempoOverridesRef.current[step.sourceExerciseId] = value;
    setTempoOverrides((values) => ({ ...values, [step.sourceExerciseId]: value }));
    audio.updateMetronomeTempo(value);
  };
  const saveTempo = () => {
    if (!isExercise || currentTempo === null) return;
    onSaveTempo?.(step.sourceExerciseId, currentTempo);
    setSavedTempos((values) => ({ ...values, [step.sourceExerciseId]: currentTempo }));
  };
  const changeSound = (sound: MetronomeSound) => {
    soundOverrideRef.current = sound;
    setSoundOverride(sound);
    if (isExercise && currentTempo !== null) audio.updateMetronomeSound(sound);
  };
  const saveSound = () => {
    onSaveMetronomeSound?.(soundOverride);
    setSavedSound(soundOverride);
  };
  const finishOrSkip = () => {
    if (paused) runner.current?.resume();
    runner.current?.skipStep();
  };

  return (
    <main className={`session-player ${ringTone}-session`} aria-live="polite">
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
        tone={ringTone}
        label="Session progress"
      />
      <section className="session-heading">
        <h1>{title}</h1>
        {nextStep && <p className="next-step">Up next: {stepMetadata(nextStep)}</p>}
      </section>
      <TimerRing
        value={
          currentTempo !== null ? (
            <div className="ring-tempo-control">
              <button aria-label="Decrease tempo" onClick={() => changeTempo(-1)}>
                −
              </button>
              <strong>
                {currentTempo}
                <small>BPM</small>
              </strong>
              <button aria-label="Increase tempo" onClick={() => changeTempo(1)}>
                +
              </button>
              {currentTempo !== savedTempo && (
                <button className="ring-save" aria-label="Save tempo" onClick={saveTempo}>
                  Save
                </button>
              )}
            </div>
          ) : (
            <>
              <SessionIllustration
                kind={isBreak ? "break" : isQuickRest ? "quick-rest" : "exercise"}
              />
              <span className="ring-time">{formatTime(displaySeconds ?? elapsedSec)}</span>
            </>
          )
        }
        label={displaySeconds === null ? "Elapsed time" : "Remaining time"}
        accessibleValue={formatTime(displaySeconds ?? elapsedSec)}
        progress={progress}
        tone={ringTone}
      />
      {isExercise && currentTempo !== null && (
        <div className="metronome-sound-control">
          <label>
            <span>Metronome sound</span>
            <select
              value={soundOverride}
              onChange={(event) => changeSound(event.target.value as MetronomeSound)}
            >
              {Object.keys(practiceConfig.metronome.sounds).map((sound) => (
                <option key={sound} value={sound}>
                  {sound[0]!.toUpperCase() + sound.slice(1)}
                </option>
              ))}
            </select>
          </label>
          {soundOverride !== savedSound && <button onClick={saveSound}>Save sound</button>}
        </div>
      )}
      {isExercise && currentTempo !== null && (
        <div className="beat-indicator" aria-label="Metronome beat">
          {[0, 1, 2, 3].map((dot) => (
            <span key={dot} className={dot === beat && !paused ? "active" : ""} />
          ))}
        </div>
      )}
      {!audioAvailable && (
        <p role="status" className="session-banner">
          Audio is unavailable. Timers and controls still work.
        </p>
      )}
      {state.status === "interrupted" && (
        <p role="alert" className="session-banner">
          Session paused while the app was in the background.
        </p>
      )}
      <div className="player-controls" aria-label="Session controls">
        <button
          aria-label="Rewind step"
          title="Rewind step"
          onClick={() => runner.current?.rewind()}
        >
          ↺
        </button>
        <button
          className="primary"
          aria-label={paused ? "Resume session" : "Pause session"}
          title={paused ? "Resume session" : "Pause session"}
          onClick={() => (paused ? runner.current?.resume() : runner.current?.pause())}
        >
          {paused ? "▶" : "Ⅱ"}
        </button>
        <button aria-label="Stop session" title="Stop session" onClick={() => setStopOpen(true)}>
          ■
        </button>
        <button
          aria-label={isQuickRest ? "Skip Quick Rest" : "Finish step"}
          title={isQuickRest ? "Skip Quick Rest" : "Finish step"}
          onClick={finishOrSkip}
        >
          {isQuickRest ? "↠" : "✓"}
        </button>
      </div>
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
              runner.current?.stop();
            }}
          />
        </BottomSheet>
      )}
    </main>
  );
}

function NowPlayingSheet({
  steps,
  currentIndex,
  quickRest,
  onClose,
}: {
  steps: SessionStep[];
  currentIndex: number;
  quickRest: boolean;
  onClose(): void;
}) {
  return (
    <BottomSheet title="Now Playing" onClose={onClose}>
      <ol className="now-playing-list">
        {steps.map((item, itemIndex) => (
          <li
            key={item.id}
            data-current={(itemIndex === currentIndex && !quickRest) || undefined}
            data-up-next={(itemIndex === currentIndex + 1 && quickRest) || undefined}
          >
            <strong>{stepMetadata(item)}</strong>
            {itemIndex === currentIndex && !quickRest && <span>Current</span>}
            {itemIndex === currentIndex + 1 && quickRest && <span>Up next</span>}
          </li>
        ))}
      </ol>
    </BottomSheet>
  );
}

function stepMetadata(step: SessionStep): string {
  if (step.kind === "break") return `Break · ${formatTime(step.durationSec)}`;
  const metadata = [step.title];
  if (step.tempoBpm !== null) metadata.push(`${step.tempoBpm} BPM`);
  if (step.durationSec !== null) metadata.push(formatTime(step.durationSec));
  return metadata.join(" · ");
}

function StopSlider({ onStop }: { onStop(): void }) {
  const [value, setValue] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fired = useRef(false);
  const threshold = practiceConfig.interaction.slideToStopThreshold * 100;
  const commit = (next: number) => {
    setValue(next);
    if (next >= threshold && !fired.current) {
      fired.current = true;
      onStop();
    }
  };
  const pointerValue = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return Math.round(
      Math.min(
        100,
        Math.max(0, ((event.clientX - bounds.left - 4) / Math.max(1, bounds.width - 56)) * 100),
      ),
    );
  };
  return (
    <div
      className="stop-slider"
      style={{ "--slider-value": value / 100 } as CSSProperties}
      role="slider"
      tabIndex={0}
      aria-label="Slide to stop"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      data-dragging={dragging}
      onPointerDown={(event) => {
        fired.current = false;
        setDragging(true);
        event.currentTarget.setPointerCapture?.(event.pointerId);
        commit(pointerValue(event));
      }}
      onPointerMove={(event) => {
        if (dragging) setValue(pointerValue(event));
      }}
      onPointerUp={(event) => {
        if (!dragging) return;
        const next = pointerValue(event);
        setDragging(false);
        commit(next);
        if (next < threshold) setValue(0);
      }}
      onPointerCancel={() => {
        setDragging(false);
        fired.current = false;
        setValue(0);
      }}
      onKeyDown={(event) => {
        if (event.key === "End") commit(100);
        else if (event.key === "Home") {
          fired.current = false;
          setValue(0);
        } else if (event.key === "ArrowRight" || event.key === "ArrowUp")
          commit(Math.min(100, value + 10));
        else if (event.key === "ArrowLeft" || event.key === "ArrowDown")
          setValue(Math.max(0, value - 10));
      }}
      onBlur={() => {
        if (value < threshold) {
          fired.current = false;
          setValue(0);
        }
      }}
    >
      <span>■</span>
      <strong>Slide to stop</strong>
    </div>
  );
}

function EndScreen({ title, copy, onExit }: { title: string; copy: string; onExit(): void }) {
  return (
    <main className="session-player completion">
      <h1>{title}</h1>
      <p>{copy}</p>
      <button className="primary" onClick={onExit}>
        Return to routine
      </button>
    </main>
  );
}
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
