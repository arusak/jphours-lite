import type { Ref } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { ChevronRightIcon, MetronomeSoundSheet, SettingsIcon } from '../../../components'
import { practiceConfig } from '../../../config/practice-config'
import type { Routine } from '../../../domain/routine'
import { Stepper } from '../Stepper/Stepper'
import styles from './RoutineSettings.module.css'

interface RoutineSettingsProps {
  summaryButtonRef?: Ref<HTMLButtonElement>
  routine: Routine
  onUpdateSetting(key: 'quickRestDurationSec' | 'warningLeadTimeSec', delta: number): void
  onSoundChange(sound: Routine['metronomeSound']): void
  onAlternateBeatToneChange(alternateBeatTone: boolean): void
}

export function RoutineSettings({
  summaryButtonRef,
  routine,
  onUpdateSetting,
  onSoundChange,
  onAlternateBeatToneChange,
}: RoutineSettingsProps) {
  const [soundPickerOpen, setSoundPickerOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const summaryRef = useRef<HTMLButtonElement>(null)
  const collapseRef = useRef<HTMLButtonElement>(null)
  const focusPending = useRef(false)
  useLayoutEffect(() => {
    if (focusPending.current) {
      ;(expanded ? collapseRef : summaryRef).current?.focus()
      focusPending.current = false
    }
  }, [expanded])
  const toggle = () => {
    focusPending.current = true
    setExpanded((current) => !current)
  }
  const soundLabel = routine.metronomeSound[0]!.toUpperCase() + routine.metronomeSound.slice(1)
  const warningLabel = routine.warningLeadTimeSec === 0 ? 'Off' : `${routine.warningLeadTimeSec}s`

  return (
    <section className={styles.routineSettings} aria-label="Routine settings">
      <div className={styles.surface} data-expanded={expanded}>
        <div className={styles.face} aria-hidden={expanded} inert={expanded}>
          <header className={styles.settingsHeader}>
            <h2>
              <button
                type="button"
                ref={(node) => {
                  summaryRef.current = node
                  if (typeof summaryButtonRef === 'function') return summaryButtonRef(node)
                  if (summaryButtonRef) summaryButtonRef.current = node
                }}
                aria-expanded={expanded}
                aria-controls="routine-settings-panel"
                onClick={toggle}
              >
                <SettingsIcon aria-hidden="true" />
                <span className={styles.summaryDetail}>
                  Quick Rest {routine.quickRestDurationSec}s · Warning cue {warningLabel} ·{' '}
                  {soundLabel} Click
                </span>
                <ChevronRightIcon aria-hidden="true" />
              </button>
            </h2>
          </header>
        </div>
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
              decreaseDisabled={
                routine.quickRestDurationSec <= practiceConfig.quickRestDuration.min
              }
              increaseDisabled={
                routine.quickRestDurationSec >= practiceConfig.quickRestDuration.max
              }
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
            <button
              type="button"
              ref={collapseRef}
              className={styles.collapse}
              aria-label="Collapse settings"
              onClick={toggle}
            >
              <ChevronRightIcon aria-hidden="true" />
            </button>
          </div>
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
