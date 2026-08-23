import { practiceConfig, type MetronomeSound } from '../../config/practice-config'
import { BottomSheet } from '../BottomSheet/BottomSheet'
import styles from './MetronomeSoundSheet.module.css'

interface MetronomeSoundSheetProps {
  open: boolean
  sound: MetronomeSound
  onChange(sound: MetronomeSound): void
  alternateBeatTone: boolean
  onAlternateBeatToneChange(enabled: boolean): void
  onClose(): void
}

function soundLabel(sound: MetronomeSound) {
  return sound[0]!.toUpperCase() + sound.slice(1)
}

export function MetronomeSoundSheet({
  open,
  sound,
  onChange,
  alternateBeatTone,
  onAlternateBeatToneChange,
  onClose,
}: MetronomeSoundSheetProps) {
  return (
    <BottomSheet open={open} title="Metronome sound" onClose={onClose}>
      <div className={styles.content}>
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
        <div className={styles.alternateBeatTone}>
          <span>
            <strong>Alternate beat tone</strong>
            <small>Even beats use a lower tone.</small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={alternateBeatTone}
            aria-label="Alternate beat tone"
            onClick={() => onAlternateBeatToneChange(!alternateBeatTone)}
          >
            <span aria-hidden="true" />
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
