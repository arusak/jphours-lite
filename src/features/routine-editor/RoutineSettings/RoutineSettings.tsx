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
}

export function RoutineSettings({ routine, onUpdateSetting, onSoundChange }: RoutineSettingsProps) {
  const [soundPickerOpen, setSoundPickerOpen] = useState(false)
  const soundLabel = routine.metronomeSound[0]!.toUpperCase() + routine.metronomeSound.slice(1)

  return (
    <section className={styles.routineSettings} aria-labelledby="routine-settings-title">
      <header className={styles.settingsHeader}>
        <div>
          <h2 id="routine-settings-title">Session settings</h2>
          <p>Applied throughout this routine</p>
        </div>
      </header>
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
          value={routine.warningLeadTimeSec === 0 ? 'Off' : `${routine.warningLeadTimeSec}s`}
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
      {soundPickerOpen && (
        <MetronomeSoundSheet
          sound={routine.metronomeSound}
          onChange={onSoundChange}
          onClose={() => setSoundPickerOpen(false)}
        />
      )}
    </section>
  )
}
