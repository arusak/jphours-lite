import { BottomSheet } from "../../components";
import { practiceConfig } from "../../config/practice-config";
import type { Exercise, RoutineEntry } from "../../domain/routine";
import { validateEntry } from "../../domain/validation";
import type { EditorSheet as Sheet } from "./types";
import styles from "./RoutineEditor.module.css";

interface EditorSheetProps {
  sheet: Sheet;
  submitted: boolean;
  onChange(value: Sheet): void;
  onSave(): void;
  onCancel(): void;
}
const minute = 60;
export function EditorSheet({ sheet, submitted, onChange, onSave, onCancel }: EditorSheetProps) {
  const entry = sheet.kind === "entry" ? sheet.entry : null;
  const errors = entry && submitted ? validateEntry(entry) : {};
  const mutate = (value: Partial<Exercise>) =>
    entry &&
    onChange({
      kind: "entry",
      entry: { ...entry, ...value } as RoutineEntry,
      index: sheet.kind === "entry" ? sheet.index : null,
    });
  const durationChange = (delta: number) => {
    if (!entry) return;
    const policy =
      entry.kind === "break" ? practiceConfig.breakDuration : practiceConfig.exerciseDuration;
    const base = entry.durationSec ?? (delta > 0 ? minute : policy.default);
    mutate({ durationSec: Math.max(policy.min, Math.min(policy.max, base + delta)) });
  };
  const title =
    sheet.kind === "routine"
      ? "Edit routine"
      : sheet.index === null
        ? `Add ${entry!.kind}`
        : `Edit ${entry!.kind}`;
  return (
    <BottomSheet title={title} onClose={onCancel}>
      {sheet.kind === "routine" ? (
        <label>
          Routine name
          <input
            value={sheet.name}
            onChange={(event) => onChange({ kind: "routine", name: event.target.value })}
          />
        </label>
      ) : (
        <>
          <>
            {entry!.kind === "exercise" && (
              <label>
                Exercise name
                <input
                  value={entry!.title}
                  aria-invalid={Boolean(errors.title)}
                  onChange={(event) => mutate({ title: event.target.value })}
                />
              </label>
            )}
          </>
          <>
            {entry!.kind === "exercise" && (
              <label className={styles.editorStepper}>
                Tempo (BPM)
                <span>
                  <button
                    aria-label="Decrease tempo"
                    onClick={() =>
                      mutate({
                        tempoBpm: Math.max(
                          practiceConfig.tempo.min,
                          (entry!.tempoBpm ?? practiceConfig.tempo.default) - 1,
                        ),
                      })
                    }
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={entry!.tempoBpm ?? ""}
                    onChange={(event) =>
                      mutate({
                        tempoBpm: event.target.value === "" ? null : Number(event.target.value),
                      })
                    }
                  />
                  <button
                    aria-label="Increase tempo"
                    onClick={() =>
                      mutate({
                        tempoBpm: Math.min(
                          practiceConfig.tempo.max,
                          (entry!.tempoBpm ?? practiceConfig.tempo.default) + 1,
                        ),
                      })
                    }
                  >
                    +
                  </button>
                </span>
              </label>
            )}
          </>
          <label className={styles.editorStepper}>
            Duration (minutes)
            <span>
              <button aria-label="Decrease duration" onClick={() => durationChange(-minute)}>
                −
              </button>
              <input
                type="number"
                step="1"
                value={entry!.durationSec === null ? "" : entry!.durationSec / minute}
                onChange={(event) =>
                  mutate({
                    durationSec:
                      event.target.value === "" ? null : Number(event.target.value) * minute,
                  })
                }
              />
              <button aria-label="Increase duration" onClick={() => durationChange(minute)}>
                +
              </button>
            </span>
          </label>
          {errors.title && (
            <p className={styles.editorAlert} role="alert">
              {errors.title}
            </p>
          )}
          {errors.durationSec && (
            <p className={styles.editorAlert} role="alert">
              {errors.durationSec}
            </p>
          )}
        </>
      )}
      <div className={styles.sheetActions}>
        <button className={styles.primaryAction} onClick={onSave}>
          Save
        </button>
        <button className={styles.secondaryAction} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </BottomSheet>
  );
}
