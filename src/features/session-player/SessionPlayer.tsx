import { useEffect, useMemo, useRef, useState } from "react";
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
}

function cueForCompleted(step: SessionStep): "exercise-complete" | "break-complete" {
  return step.kind === "break" ? "break-complete" : "exercise-complete";
}

export function SessionPlayer({ routine, onExit }: SessionPlayerProps) {
  const [state, setState] = useState<SessionState>(initialSessionState);
  const [now, setNow] = useState(0);
  const audio = useMemo(() => new AudioController(), []);
  const wakeLock = useMemo(() => new WakeLockController(), []);
  const runner = useRef<SessionRunner | null>(null);

  useEffect(() => {
    runner.current = new SessionRunner(undefined, undefined, {
      onStateChange: setState,
      onStepStart: (step) => {
        if (step.kind === "exercise" && step.mode === "paced-timed" && step.tempoBpm) audio.startMetronome({ bpm: step.tempoBpm });
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
    void audio.unlock().finally(() => {
      runner.current?.start(routine);
      void wakeLock.acquire();
    });
  }, [audio, routine, wakeLock]);

  const step = state.currentStepIndex === null ? null : state.steps[state.currentStepIndex] ?? null;
  const next = state.currentStepIndex === null ? null : state.steps[state.currentStepIndex + 1] ?? null;
  const remainingSec = state.currentStepEndsAt === null ? null : Math.max(0, Math.ceil((state.currentStepEndsAt - now) / 1000));
  const elapsedSec = state.currentStepStartedAt === null ? 0 : Math.max(0, Math.floor((now - state.currentStepStartedAt) / 1000));

  if (state.status === "completed") return <main className="session-player completion"><h1>Routine complete</h1><p>Nice work — every exercise is finished.</p><button onClick={onExit}>Return to editor</button></main>;
  if (state.status === "stopped") return <main className="session-player completion"><h1>Session stopped</h1><button onClick={onExit}>Return to editor</button></main>;
  if (!step) return null;

  const paused = state.status === "paused" || state.status === "interrupted";
  const displaySeconds = paused && state.pausedRemainingSec !== null ? Math.ceil(state.pausedRemainingSec) : remainingSec;
  const stepPosition = state.currentStepIndex ?? 0;
  return <main className="session-player" aria-live="polite">
    <p className="eyebrow">{step.kind === "break" ? "Break" : "Exercise"} {stepPosition + 1} of {state.steps.length}</p>
    <h1>{step.kind === "break" ? "Break" : step.title}</h1>
    {step.kind === "exercise" && <p>{step.mode.replace("-", " ")}{step.tempoBpm ? ` · ${step.tempoBpm} BPM` : ""}</p>}
    <p className="timer">{displaySeconds === null ? formatTime(elapsedSec) : formatTime(displaySeconds)}</p>
    <p>{displaySeconds === null ? "Elapsed" : "Remaining"}</p>
    {next && <p className="next">Next: {next.kind === "break" ? "Break" : next.title}</p>}
    {state.status === "interrupted" && <p role="alert">Session paused while the app was in the background.</p>}
    <div className="player-controls">
      {paused ? <button className="primary" onClick={() => runner.current?.resume()}>Resume</button> : <button className="primary" onClick={() => runner.current?.pause()}>Pause</button>}
      {!paused && <button onClick={() => runner.current?.skipStep()}>{step.kind === "break" ? "Skip break" : "End / skip exercise"}</button>}
      <button className="danger" onClick={() => runner.current?.stop()}>Stop session</button>
    </div>
  </main>;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
