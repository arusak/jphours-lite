import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ProgressSegments, TimerRing } from "../../components";
import type { Routine } from "../../domain/routine";
import type { SessionStep } from "../../domain/session";
import { AudioController } from "../../services/audio";
import { WakeLockController } from "../../services/platform/wakeLock";
import { observeVisibility } from "../../services/platform/visibilityLifecycle";
import { SessionRunner } from "../../services/session/SessionRunner";
import { initialSessionState, type SessionState } from "../../services/session/sessionReducer";

export interface SessionPlayerProps {
  routine: Routine;
  onExit(): void;
  onSaveTempo?(sourceExerciseId: string, tempoBpm: number): void;
}

function cueForCompleted(step: SessionStep): "exercise-complete" | "break-complete" {
  return step.kind === "break" ? "break-complete" : "exercise-complete";
}

export function SessionPlayer({ routine, onExit, onSaveTempo }: SessionPlayerProps) {
  const [state, setState] = useState<SessionState>(initialSessionState);
  const [now, setNow] = useState(() => performance.now());
  const [tempoOverrides, setTempoOverrides] = useState<Record<string, number>>({});
  const [savedTempos, setSavedTempos] = useState<Record<string, number>>({});
  const [beat, setBeat] = useState(0);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const tempoOverridesRef = useRef<Record<string, number>>({});
  const audio = useMemo(() => new AudioController(), []);
  const wakeLock = useMemo(() => new WakeLockController(), []);
  const runner = useRef<SessionRunner | null>(null);

  useEffect(() => {
    runner.current = new SessionRunner(undefined, undefined, {
      onStateChange: setState,
      onStepStart: (step) => {
        if (step.kind === "exercise" && step.tempoBpm !== null) {
          const bpm = tempoOverridesRef.current[step.sourceExerciseId] ?? step.tempoBpm;
          audio.startMetronome({
            bpm,
            onBeatScheduled: ({ beat: nextBeat }) => setBeat(nextBeat % 4),
          });
        }
      },
      onStepStop: (step, reason) => {
        audio.stopMetronome();
        if (reason === "STEP_COMPLETED") audio.playCue(cueForCompleted(step));
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
  const next =
    state.currentStepIndex === null ? null : (state.steps[state.currentStepIndex + 1] ?? null);
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
        copy="Nice work — every exercise is finished."
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
  const index = state.currentStepIndex ?? 0;
  const isExercise = step.kind === "exercise";
  const currentTempo =
    isExercise && step.tempoBpm !== null
      ? (tempoOverrides[step.sourceExerciseId] ?? step.tempoBpm)
      : null;
  const savedTempo =
    isExercise && step.tempoBpm !== null
      ? (savedTempos[step.sourceExerciseId] ?? step.tempoBpm)
      : null;
  const duration = step.durationSec;
  const progress =
    duration === null || displaySeconds === null
      ? null
      : Math.min(1, Math.max(0, (duration - displaySeconds) / duration));

  const changeTempo = (delta: number) => {
    if (!isExercise || currentTempo === null) return;
    const value = Math.min(300, Math.max(20, currentTempo + delta));
    tempoOverridesRef.current[step.sourceExerciseId] = value;
    setTempoOverrides((values) => ({ ...values, [step.sourceExerciseId]: value }));
    audio.updateMetronomeTempo(value);
  };
  const saveTempo = () => {
    if (!isExercise || currentTempo === null) return;
    onSaveTempo?.(step.sourceExerciseId, currentTempo);
    setSavedTempos((values) => ({ ...values, [step.sourceExerciseId]: currentTempo }));
  };

  return (
    <main
      className={`session-player ${isExercise ? "exercise-session" : "break-session"}`}
      aria-live="polite"
    >
      <header className="session-header">
        <button aria-label="Back" onClick={onExit}>
          ←
        </button>
        <div>
          <p className="eyebrow">NOW PLAYING</p>
          <p>{routine.name}</p>
        </div>
        <span aria-hidden="true" />
      </header>
      <ProgressSegments
        count={state.steps.length}
        current={index}
        tone={isExercise ? "exercise" : "break"}
        label={`Step ${index + 1} of ${state.steps.length}`}
      />
      {isExercise ? (
        <>
          <section className="session-heading">
            <p className="section-label">
              Exercise{" "}
              {state.steps.slice(0, index + 1).filter((item) => item.kind === "exercise").length} of{" "}
              {routine.exercises.length}
            </p>
            <h1>{step.title}</h1>
          </section>
          {currentTempo !== null && (
            <div className="tempo-control">
              <button aria-label="Decrease tempo" onClick={() => changeTempo(-1)}>
                −
              </button>
              <div>
                <strong>{currentTempo}</strong>
                <div>
                  <span>BPM</span>
                  {currentTempo !== savedTempo && (
                    <button aria-label="Save tempo" onClick={saveTempo}>
                      Save
                    </button>
                  )}
                </div>
              </div>
              <button aria-label="Increase tempo" onClick={() => changeTempo(1)}>
                +
              </button>
            </div>
          )}
        </>
      ) : (
        <section className="break-heading">
          <span aria-hidden="true">☕</span>
          <h1>Break</h1>
          <p>Shake it out. Reset your hands.</p>
        </section>
      )}
      <TimerRing
        value={formatTime(displaySeconds ?? elapsedSec)}
        label={displaySeconds === null ? "ELAPSED" : "REMAINING"}
        progress={progress}
        tone={step.kind === "break" ? "break" : "exercise"}
      />
      {isExercise && currentTempo !== null && (
        <div className="beat-indicator" aria-label="Metronome beat">
          {[0, 1, 2, 3].map((dot) => (
            <span key={dot} className={dot === beat && !paused ? "active" : ""} />
          ))}
        </div>
      )}
      {next && (
        <p className="next">
          Next:{" "}
          {next.kind === "break"
            ? "Break"
            : `${next.title}${next.tempoBpm ? ` · ${next.tempoBpm} BPM` : ""}`}
        </p>
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
      <div className="player-controls">
        {!isExercise && (
          <button onClick={() => runner.current?.rewindBreak()}>Rewind exercise</button>
        )}
        {paused ? (
          <button className="primary" onClick={() => runner.current?.resume()}>
            Resume
          </button>
        ) : isExercise ? (
          <button className="primary" onClick={() => runner.current?.pause()}>
            Pause
          </button>
        ) : (
          <button className="primary" onClick={() => runner.current?.skipStep()}>
            Skip break
          </button>
        )}
        {isExercise && (
          <button
            onClick={() => {
              if (paused) runner.current?.resume();
              runner.current?.skipStep();
            }}
          >
            Finish / Skip
          </button>
        )}
        {!isExercise && paused && (
          <button
            onClick={() => {
              runner.current?.resume();
              runner.current?.skipStep();
            }}
          >
            Skip break
          </button>
        )}
        {!isExercise && !paused && <button onClick={() => runner.current?.pause()}>Pause</button>}
        <StopSlider onStop={() => runner.current?.stop()} />
      </div>
    </main>
  );
}

function StopSlider({ onStop }: { onStop(): void }) {
  const [value, setValue] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fired = useRef(false);
  const commit = (next: number) => {
    setValue(next);
    if (next >= 90 && !fired.current) {
      fired.current = true;
      onStop();
    }
  };
  const pointerValue = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const travel = Math.max(1, bounds.width - 56);
    return Math.round(
      Math.min(100, Math.max(0, ((event.clientX - bounds.left - 4) / travel) * 100)),
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
        const bounds = event.currentTarget.getBoundingClientRect();
        const thumbLeft = bounds.left + 4 + (Math.max(1, bounds.width - 56) * value) / 100;
        if (event.clientX < thumbLeft || event.clientX > thumbLeft + 48) return;
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
        if (next < 90) setValue(0);
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
        if (value < 90) {
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
