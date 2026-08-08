import { practiceConfig, type MetronomeSound } from '../../config/practice-config'
import { BottomSheet } from '../BottomSheet/BottomSheet'
import styles from './MetronomeSoundSheet.module.css'

interface MetronomeSoundSheetProps {
  sound: MetronomeSound
  onChange(sound: MetronomeSound): void
  onClose(): void
}

function soundLabel(sound: MetronomeSound) {
  return sound[0]!.toUpperCase() + sound.slice(1)
}

export function MetronomeSoundSheet({ sound, onChange, onClose }: MetronomeSoundSheetProps) {
  return (
    <BottomSheet title="Metronome sound" onClose={onClose}>
      <div className={styles.soundList} role="radiogroup" aria-label="Metronome sound">
        {(Object.keys(practiceConfig.metronome.sounds) as MetronomeSound[]).map((option) => (
          <button
            key={option}
            className={option === sound ? styles.selectedSound : undefined}
            role="radio"
            aria-checked={option === sound}
            onClick={() => onChange(option)}
          >
            <span>{soundLabel(option)}</span>
            <span className={styles.selectionMark} aria-hidden="true">
              {option === sound ? '✓' : ''}
            </span>
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}
