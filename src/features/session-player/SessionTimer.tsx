import { TimerRing } from "../../components";
import { SessionIllustration } from "./SessionIllustration";
import { formatTime } from "./formatTime";
import styles from "./SessionPlayer.module.css";

interface SessionTimerProps {
  tempo: number | null;
  savedTempo: number | null;
  isBreak: boolean;
  isQuickRest: boolean;
  displaySeconds: number | null;
  elapsedSeconds: number;
  progress: number | null;
  tone: "exercise" | "break" | "quick-rest";
  onChangeTempo(delta: number): void;
  onSaveTempo(): void;
}
export function SessionTimer({
  tempo,
  savedTempo,
  isBreak,
  isQuickRest,
  displaySeconds,
  elapsedSeconds,
  progress,
  tone,
  onChangeTempo,
  onSaveTempo,
}: SessionTimerProps) {
  const time = formatTime(displaySeconds ?? elapsedSeconds);
  return (
    <TimerRing
      value={
        tempo !== null ? (
          <div className={styles.ringTempoControl}>
            <button aria-label="Decrease tempo" onClick={() => onChangeTempo(-1)}>
              −
            </button>
            <strong>
              {tempo}
              <small>BPM</small>
            </strong>
            <button aria-label="Increase tempo" onClick={() => onChangeTempo(1)}>
              +
            </button>
            {tempo !== savedTempo && (
              <button className={styles.ringSave} aria-label="Save tempo" onClick={onSaveTempo}>
                Save
              </button>
            )}
          </div>
        ) : (
          <>
            <SessionIllustration
              kind={isBreak ? "break" : isQuickRest ? "quick-rest" : "exercise"}
            />
            <span className={styles.ringTime}>{time}</span>
          </>
        )
      }
      label={displaySeconds === null ? "Elapsed time" : "Remaining time"}
      accessibleValue={time}
      progress={progress}
      tone={tone}
    />
  );
}
