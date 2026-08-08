import styles from "./SessionPlayer.module.css";

interface SessionControlsProps {
  paused: boolean;
  quickRest: boolean;
  onRewind(): void;
  onPauseResume(): void;
  onStop(): void;
  onFinishOrSkip(): void;
}
export function SessionControls({
  paused,
  quickRest,
  onRewind,
  onPauseResume,
  onStop,
  onFinishOrSkip,
}: SessionControlsProps) {
  return (
    <div className={styles.playerControls} aria-label="Session controls">
      <button aria-label="Rewind step" title="Rewind step" onClick={onRewind}>
        ↺
      </button>
      <button
        className={styles.primary}
        aria-label={paused ? "Resume session" : "Pause session"}
        title={paused ? "Resume session" : "Pause session"}
        onClick={onPauseResume}
      >
        {paused ? "▶" : "Ⅱ"}
      </button>
      <button aria-label="Stop session" title="Stop session" onClick={onStop}>
        ■
      </button>
      <button
        aria-label={quickRest ? "Skip Quick Rest" : "Finish step"}
        title={quickRest ? "Skip Quick Rest" : "Finish step"}
        onClick={onFinishOrSkip}
      >
        {quickRest ? "↠" : "✓"}
      </button>
    </div>
  );
}
