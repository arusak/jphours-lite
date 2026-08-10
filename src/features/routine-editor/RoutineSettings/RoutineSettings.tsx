import { useState } from 'react'
import { ChevronRightIcon, MetronomeSoundSheet } from '../../../components'
import { practiceConfig } from '../../../config/practice-config'
import type { Routine } from '../../../domain/routine'
import { Stepper } from '../Stepper/Stepper'
import styles from './RoutineSettings.module.css'

interface RoutineSettingsProps {
  routine: Routine
  onUpdateSetting(key: 'quickRestDurationSec' | 'warningLeadTimeSec', delta: number): void
  onSoundChange(sound: Routine['metronomeSound']): void
  onAlternateBeatToneChange(alternateBeatTone: boolean): void
}

export function RoutineSettings({
  routine,
  onUpdateSetting,
  onSoundChange,
  onAlternateBeatToneChange,
}: RoutineSettingsProps) {
  const [soundPickerOpen, setSoundPickerOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const soundLabel = routine.metronomeSound[0]!.toUpperCase() + routine.metronomeSound.slice(1)
  const warningLabel = routine.warningLeadTimeSec === 0 ? 'Off' : `${routine.warningLeadTimeSec}s`

  return (
    <section className={styles.routineSettings} aria-labelledby="routine-settings-title">
      <header className={styles.settingsHeader}>
        <h2 id="routine-settings-title">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="routine-settings-panel"
            onClick={() => setExpanded((current) => !current)}
          >
            <span>
              <strong>Session settings</strong>
              <small>
                Quick Rest {routine.quickRestDurationSec}s · Warning cue {warningLabel} ·{' '}
                {soundLabel}
              </small>
            </span>
            <ChevronRightIcon aria-hidden="true" />
          </button>
        </h2>
      </header>
      <div
        id="routine-settings-panel"
        className={styles.settingsDisclosure}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        <div className={styles.settingsCard}>
          <Stepper
            label="Quick Rest"
            description="Between adjacent exercises"
            value={`${routine.quickRestDurationSec}s`}
            decreaseDisabled={routine.quickRestDurationSec <= practiceConfig.quickRestDuration.min}
            increaseDisabled={routine.quickRestDurationSec >= practiceConfig.quickRestDuration.max}
            onDecrease={() =>
              onUpdateSetting('quickRestDurationSec', -practiceConfig.quickRestDuration.increment)
            }
            onIncrease={() =>
              onUpdateSetting('quickRestDurationSec', practiceConfig.quickRestDuration.increment)
            }
          />
          <Stepper
            label="Warning cue"
            description="Before a timed step completes"
            value={warningLabel}
            decreaseDisabled={routine.warningLeadTimeSec <= practiceConfig.warningLeadTime.min}
            increaseDisabled={routine.warningLeadTimeSec >= practiceConfig.warningLeadTime.max}
            onDecrease={() =>
              onUpdateSetting('warningLeadTimeSec', -practiceConfig.warningLeadTime.increment)
            }
            onIncrease={() =>
              onUpdateSetting('warningLeadTimeSec', practiceConfig.warningLeadTime.increment)
            }
          />
          <button
            className={styles.soundSetting}
            aria-haspopup="dialog"
            aria-expanded={soundPickerOpen}
            onClick={() => setSoundPickerOpen(true)}
          >
            <span className={styles.settingCopy}>
              <strong>Metronome sound</strong>
              <small>Beat character</small>
            </span>
            <span className={styles.soundValue}>
              {soundLabel}
              <ChevronRightIcon aria-hidden="true" />
            </span>
          </button>
        </div>
      </div>
      <MetronomeSoundSheet
        open={soundPickerOpen}
        sound={routine.metronomeSound}
        onChange={onSoundChange}
        alternateBeatTone={routine.alternateBeatTone}
        onAlternateBeatToneChange={onAlternateBeatToneChange}
        onClose={() => setSoundPickerOpen(false)}
      />
    </section>
  )
}
