import { ForwardIcon, PauseIcon, PlayIcon, RewindIcon, StopIcon } from '../../../components'
import styles from './SessionControls.module.css'

interface SessionControlsProps {
  paused: boolean
  quickRest: boolean
  onRewind(): void
  onPauseResume(): void
  onStop(): void
  onFinishOrSkip(): void
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
      <button
        className={styles.rewindButton}
        aria-label="Rewind step"
        title="Rewind step"
        onClick={onRewind}
      >
        <RewindIcon />
      </button>
      <button
        className={styles.primaryButton}
        aria-label={paused ? 'Resume session' : 'Pause session'}
        title={paused ? 'Resume session' : 'Pause session'}
        onClick={onPauseResume}
      >
        {paused ? <PlayIcon /> : <PauseIcon />}
      </button>
      <button
        className={styles.stopButton}
        aria-label="Stop session"
        title="Stop session"
        onClick={onStop}
      >
        <StopIcon />
      </button>
      <button
        className={styles.forwardButton}
        aria-label={quickRest ? 'Skip Quick Rest' : 'Finish step'}
        title={quickRest ? 'Skip Quick Rest' : 'Finish step'}
        onClick={onFinishOrSkip}
      >
        <ForwardIcon />
      </button>
    </div>
  )
}
