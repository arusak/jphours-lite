import { practiceConfig } from "../../config/practice-config";
import type { Routine } from "../../domain/routine";
import { Stepper } from "./Stepper";
import styles from "./RoutineEditor.module.css";

interface RoutineSettingsProps {
  routine: Routine;
  onUpdateSetting(key: "quickRestDurationSec" | "warningLeadTimeSec", delta: number): void;
  onSoundChange(sound: Routine["metronomeSound"]): void;
}

export function RoutineSettings({ routine, onUpdateSetting, onSoundChange }: RoutineSettingsProps) {
  return (
    <section className={styles.routineSettings} aria-label="Routine settings">
      <Stepper
        label="Quick Rest"
        value={`${routine.quickRestDurationSec}s`}
        onDecrease={() =>
          onUpdateSetting("quickRestDurationSec", -practiceConfig.quickRestDuration.increment)
        }
        onIncrease={() =>
          onUpdateSetting("quickRestDurationSec", practiceConfig.quickRestDuration.increment)
        }
      />
      <Stepper
        label="Warning"
        value={routine.warningLeadTimeSec === 0 ? "Off" : `${routine.warningLeadTimeSec}s`}
        onDecrease={() =>
          onUpdateSetting("warningLeadTimeSec", -practiceConfig.warningLeadTime.increment)
        }
        onIncrease={() =>
          onUpdateSetting("warningLeadTimeSec", practiceConfig.warningLeadTime.increment)
        }
      />
      <label>
        Metronome sound
        <select
          value={routine.metronomeSound}
          onChange={(event) => onSoundChange(event.target.value as Routine["metronomeSound"])}
        >
          {Object.keys(practiceConfig.metronome.sounds).map((sound) => (
            <option key={sound} value={sound}>
              {sound[0]!.toUpperCase() + sound.slice(1)}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
