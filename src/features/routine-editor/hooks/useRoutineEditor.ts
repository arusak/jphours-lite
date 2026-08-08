import { useEffect, useMemo, useRef, useState } from "react";
import { practiceConfig } from "../../../config/practice-config";
import { createExercise, type Routine } from "../../../domain/routine";
import { isRoutineValid, validateEntry, validateRoutine } from "../../../domain/validation";
import { DebouncedRoutineSaver } from "../../../services/persistence/debounced-routine-saver";
import type { RoutineRepository } from "../../../services/persistence/routine-repository";
import { routineTotal } from "../routineTotal";
import type { EditorSheet } from "../types";

const touch = (routine: Routine): Routine => ({ ...routine, updatedAt: new Date().toISOString() });
export function useRoutineEditor(repository: RoutineRepository) {
  const [routine, setRoutine] = useState<Routine>(() => repository.load());
  const [sheet, setSheet] = useState<EditorSheet | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const saver = useRef(new DebouncedRoutineSaver(repository));
  const validation = useMemo(() => validateRoutine(routine), [routine]);
  const total = useMemo(() => routineTotal(routine), [routine]);
  useEffect(() => saver.current.schedule(routine), [routine]);
  useEffect(() => () => saver.current.dispose(), []);
  const update = (change: (current: Routine) => Routine) =>
    setRoutine((current) => touch(change(current)));
  const close = () => {
    setSheet(null);
    setSubmitted(false);
  };
  const updateSetting = (key: "quickRestDurationSec" | "warningLeadTimeSec", delta: number) =>
    update((current) => {
      const policy =
        key === "quickRestDurationSec"
          ? practiceConfig.quickRestDuration
          : practiceConfig.warningLeadTime;
      return {
        ...current,
        [key]: Math.min(policy.max, Math.max(policy.min, current[key] + delta)),
      };
    });
  const save = () => {
    if (!sheet) return;
    if (sheet.kind === "routine") {
      update((current) => ({ ...current, name: sheet.name.trim() }));
      close();
      return;
    }
    if (Object.keys(validateEntry(sheet.entry)).length) {
      setSubmitted(true);
      return;
    }
    update((current) => ({
      ...current,
      entries:
        sheet.index === null
          ? [...current.entries, sheet.entry]
          : current.entries.map((entry, index) => (index === sheet.index ? sheet.entry : entry)),
    }));
    close();
  };
  const remove = (index: number) =>
    update((current) => {
      const entries = current.entries.filter((_, itemIndex) => itemIndex !== index);
      return { ...current, entries: entries.length ? entries : [createExercise()] };
    });
  return {
    routine,
    sheet,
    submitted,
    total,
    validation,
    valid: isRoutineValid(routine),
    setSheet,
    update,
    updateSetting,
    save,
    close,
    remove,
    flush: () => saver.current.flush(),
  };
}
