import { useEffect, useMemo, useRef, useState } from "react";
import { BottomSheet } from "../../components";
import { practiceConfig } from "../../config/practice-config";
import { createBreak, createExercise, type Exercise, type Routine, type RoutineEntry } from "../../domain/routine";
import { isRoutineValid, validateEntry, validateRoutine } from "../../domain/validation";
import { DebouncedRoutineSaver } from "../../services/persistence/debounced-routine-saver";
import type { RoutineRepository } from "../../services/persistence/routine-repository";

export interface RoutineEditorProps { repository: RoutineRepository; onStartSession?(routine: Routine): void; }
type Sheet = { kind: "routine"; name: string } | { kind: "entry"; entry: RoutineEntry; index: number | null } | null;
const touch = (routine: Routine): Routine => ({ ...routine, updatedAt: new Date().toISOString() });
const minute = 60;

export function routineTotal(routine: Routine): { minutes: number; approximate: boolean } {
  let seconds = 0; let approximate = false;
  routine.entries.forEach((entry, index) => {
    if (entry.kind === "exercise" && entry.durationSec === null) { seconds += practiceConfig.exerciseDuration.default; approximate = true; }
    else if (entry.durationSec !== null) seconds += entry.durationSec;
    const next = routine.entries[index + 1];
    if (entry.kind === "exercise" && next?.kind === "exercise") seconds += routine.quickRestDurationSec;
  });
  return { minutes: Math.ceil(seconds / minute), approximate };
}

export function RoutineEditor({ repository, onStartSession }: RoutineEditorProps) {
  const [routine, setRoutine] = useState<Routine>(() => repository.load());
  const [sheet, setSheet] = useState<Sheet>(null);
  const [submitted, setSubmitted] = useState(false);
  const saver = useRef(new DebouncedRoutineSaver(repository));
  const validation = useMemo(() => validateRoutine(routine), [routine]);
  const total = useMemo(() => routineTotal(routine), [routine]);
  useEffect(() => saver.current.schedule(routine), [routine]);
  useEffect(() => () => saver.current.dispose(), []);
  const update = (change: (current: Routine) => Routine) => setRoutine((current) => touch(change(current)));
  const close = () => { setSheet(null); setSubmitted(false); };
  const updateSetting = (key: "quickRestDurationSec" | "warningLeadTimeSec", delta: number) => update((current) => {
    const policy = key === "quickRestDurationSec" ? practiceConfig.quickRestDuration : practiceConfig.warningLeadTime;
    const value = Math.min(policy.max, Math.max(policy.min, current[key] + delta));
    return { ...current, [key]: value, ...(key === "quickRestDurationSec" ? { defaultBreakDurationSec: value } : {}) };
  });
  const save = () => {
    if (!sheet) return;
    if (sheet.kind === "routine") { update((current) => ({ ...current, name: sheet.name.trim() })); close(); return; }
    if (Object.keys(validateEntry(sheet.entry)).length) { setSubmitted(true); return; }
    update((current) => {
      const entries = sheet.index === null ? [...current.entries, sheet.entry] : current.entries.map((entry, index) => index === sheet.index ? sheet.entry : entry);
      return { ...current, entries };
    }); close();
  };
  const remove = (index: number) => update((current) => {
    const entries = current.entries.filter((_, itemIndex) => itemIndex !== index);
    return { ...current, entries: entries.length ? entries : [createExercise()] };
  });
  return <section className="routine-editor" aria-labelledby="routine-editor-title">
    <header className="routine-header compact"><h1 id="routine-editor-title">{routine.name.trim() || "Practice routine"}</h1><button className="routine-edit" aria-label="Edit routine name" onClick={() => setSheet({ kind: "routine", name: routine.name })}>✎</button><span className="routine-total" aria-label={`${total.approximate ? "approximately " : ""}${total.minutes} minutes`}>{total.approximate ? "≈" : ""}{total.minutes} min</span></header>
    <section className="routine-settings" aria-label="Routine settings">
      <Stepper label="Quick Rest" value={`${routine.quickRestDurationSec}s`} onDecrease={() => updateSetting("quickRestDurationSec", -practiceConfig.quickRestDuration.increment)} onIncrease={() => updateSetting("quickRestDurationSec", practiceConfig.quickRestDuration.increment)} />
      <Stepper label="Warning" value={routine.warningLeadTimeSec === 0 ? "Off" : `${routine.warningLeadTimeSec}s`} onDecrease={() => updateSetting("warningLeadTimeSec", -practiceConfig.warningLeadTime.increment)} onIncrease={() => updateSetting("warningLeadTimeSec", practiceConfig.warningLeadTime.increment)} />
      <label>Metronome sound<select value={routine.metronomeSound} onChange={(event) => update((current) => ({ ...current, metronomeSound: event.target.value as Routine["metronomeSound"] }))}>{Object.keys(practiceConfig.metronome.sounds).map((sound) => <option key={sound} value={sound}>{sound[0].toUpperCase() + sound.slice(1)}</option>)}</select></label>
    </section>
    <div className="exercise-list" aria-label="Routine entries">{routine.entries.map((entry, index) => <article className={`exercise-card entry-card entry-card--${entry.kind}`} key={entry.id}><div className="exercise-card-content"><div className="exercise-title-row"><span>{index + 1}</span><h3>{entry.kind === "break" ? "Break" : entry.title}</h3></div><div className="exercise-meta">{entry.kind === "exercise" && entry.tempoBpm !== null && <span className="badge tempo">♪ {entry.tempoBpm} BPM</span>}<span className="badge">◷ {entry.durationSec === null ? "Open-ended" : `${entry.durationSec / minute} min`}</span></div></div><button className="card-action" aria-label={`Edit ${entry.kind === "break" ? "Break" : entry.title}`} onClick={() => setSheet({ kind: "entry", entry: { ...entry }, index })}>✎</button><button className="card-action delete" aria-label={`Delete ${entry.kind === "break" ? "Break" : entry.title}`} onClick={() => remove(index)}>×</button></article>)}</div>
    <div className="entry-actions"><button className="add-exercise" onClick={() => setSheet({ kind: "entry", entry: createExercise(), index: null })}>＋ Add exercise</button><button className="add-exercise" onClick={() => setSheet({ kind: "entry", entry: createBreak(), index: null })}>＋ Add break</button></div>
    {!isRoutineValid(routine) && <p className="editor-error" role="alert">{validation.entries || "Complete each routine entry."}</p>}
    <footer className="editor-footer"><button className="primary-action" disabled={!isRoutineValid(routine)} onClick={() => { saver.current.flush(); onStartSession?.(routine); }}>▶ Start session</button></footer>
    {sheet && <EditorSheet sheet={sheet} submitted={submitted} onChange={setSheet} onSave={save} onCancel={close} />}
  </section>;
}

function Stepper({ label, value, onDecrease, onIncrease }: { label: string; value: string; onDecrease(): void; onIncrease(): void }) { return <div className="setting-stepper"><span>{label}</span><button aria-label={`Decrease ${label}`} onClick={onDecrease}>−</button><output>{value}</output><button aria-label={`Increase ${label}`} onClick={onIncrease}>+</button></div>; }
function EditorSheet({ sheet, submitted, onChange, onSave, onCancel }: { sheet: Exclude<Sheet, null>; submitted: boolean; onChange(value: Exclude<Sheet, null>): void; onSave(): void; onCancel(): void }) {
  const entry = sheet.kind === "entry" ? sheet.entry : null; const errors = entry && submitted ? validateEntry(entry) : {};
  const mutate = (value: Partial<Exercise>) => entry && onChange({ kind: "entry", entry: { ...entry, ...value } as RoutineEntry, index: sheet.kind === "entry" ? sheet.index : null });
  const durationChange = (delta: number) => { if (!entry) return; const policy = entry.kind === "break" ? practiceConfig.breakDuration : practiceConfig.exerciseDuration; const base = entry.durationSec ?? (delta > 0 ? minute : policy.default); mutate({ durationSec: Math.max(policy.min, Math.min(policy.max, base + delta)) }); };
  const title = sheet.kind === "routine" ? "Edit routine" : sheet.index === null ? `Add ${entry!.kind}` : `Edit ${entry!.kind}`;
  return (
    <BottomSheet title={title} onClose={onCancel}>
      {sheet.kind === "routine" ? (
        <label>Routine name<input value={sheet.name} onChange={(event) => onChange({ kind: "routine", name: event.target.value })} /></label>
      ) : (
        <>
          {entry!.kind === "exercise" && <label>Exercise name<input value={entry!.title} aria-invalid={Boolean(errors.title)} onChange={(event) => mutate({ title: event.target.value })} /></label>}
          {entry!.kind === "exercise" && <label className="editor-stepper">Tempo (BPM)<span><button aria-label="Decrease tempo" onClick={() => mutate({ tempoBpm: Math.max(practiceConfig.tempo.min, (entry!.tempoBpm ?? practiceConfig.tempo.default) - 1) })}>−</button><input type="number" value={entry!.tempoBpm ?? ""} onChange={(event) => mutate({ tempoBpm: event.target.value === "" ? null : Number(event.target.value) })} /><button aria-label="Increase tempo" onClick={() => mutate({ tempoBpm: Math.min(practiceConfig.tempo.max, (entry!.tempoBpm ?? practiceConfig.tempo.default) + 1) })}>+</button></span></label>}
          <label className="editor-stepper">Duration (minutes)<span><button aria-label="Decrease duration" onClick={() => durationChange(-minute)}>−</button><input type="number" value={entry!.durationSec === null ? "" : entry!.durationSec / minute} onChange={(event) => mutate({ durationSec: event.target.value === "" ? null : Number(event.target.value) * minute })} /><button aria-label="Increase duration" onClick={() => durationChange(minute)}>+</button></span></label>
          {errors.title && <p role="alert">{errors.title}</p>}{errors.durationSec && <p role="alert">{errors.durationSec}</p>}
        </>
      )}
      <div className="sheet-actions"><button className="primary-action" onClick={onSave}>Save</button><button className="secondary-action" onClick={onCancel}>Cancel</button></div>
    </BottomSheet>
  );
}
