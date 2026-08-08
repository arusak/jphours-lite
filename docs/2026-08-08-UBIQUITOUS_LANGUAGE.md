# Ubiquitous Language

## Practice design

| Term                          | Definition                                                                                                                | Aliases to avoid                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Routine**                   | A saved, ordered practice plan containing Routine entries and shared Session settings.                                    | Workout, program, playlist       |
| **Routine entry**             | One saved element in a Routine's ordered sequence: either an Exercise or a Break.                                         | Task, item, Step                 |
| **Exercise**                  | A named Routine entry configured with an optional Tempo and optional Duration.                                            | Task, item, drill                | ¶   |
| **Break**                     | A timed Routine entry with the fixed title “Break,” a required Duration, and no Tempo.                                    | Long break, big break, Exercise  |
| **Tempo**                     | The Metronome rate for an Exercise, expressed in beats per minute (BPM).                                                  | Speed, rate, BPM setting         |
| **Duration**                  | The configured length of a timed Exercise, Break, or Quick Rest, stored in seconds.                                       | Time, timer length               |
| **Default Exercise Duration** | The configured Duration assigned to new Exercises and used to estimate open-ended Exercises in calculated Routine totals. | Default time, assumed time       |
| **Quick Rest Duration**       | The shared interval used for a Quick Rest between directly adjacent Exercises.                                            | Small break duration, pause time |
| **Warning lead time**         | The Routine setting that determines how long before Completion an eligible Warning cue is scheduled.                      | Warning time, alert time         |
| **Metronome sound**           | The Routine's selected audible character for Beats.                                                                       | Click sound, tick sound          |
| **Exercise mode**             | The derived combination of an Exercise's Tempo and Duration that determines how it runs.                                  | Exercise type, configuration     |
| **Paced timed exercise**      | An Exercise with both a Tempo and a Duration.                                                                             | Metronome exercise               |
| **Paced open-ended exercise** | An Exercise with a Tempo and no Duration that continues until the practitioner chooses Finish step.                       | Untimed metronome exercise       |
| **Open-ended exercise**       | An Exercise with neither Tempo nor Duration that continues until the practitioner chooses Finish step.                    | Manual task, free exercise       |

## Guided practice session

| Term               | Definition                                                                                                         | Aliases to avoid              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| **Session**        | One guided execution of a Routine from its captured Session plan.                                                  | Run, workout, playback        |
| **Session plan**   | The immutable ordered sequence of Steps and captured Quick Rest transitions created when a Session starts.         | Session snapshot, queue       |
| **Step**           | One executable Session-plan element: either an Exercise step or a Break step.                                      | Task, item, Quick Rest        |
| **Exercise step**  | A Step representing one specific Exercise as configured when the Session started.                                  | Exercise, task                |
| **Break step**     | A timed Step representing one specific Break as configured when the Session started.                               | Quick Rest, pause, long break |
| **Quick Rest**     | A timed transition between directly adjacent Exercise steps; it is captured by the Session plan but is not a Step. | Small break, rest Step, pause |
| **Current phase**  | The Exercise step, Break step, or Quick Rest presently being presented or run.                                     | Active exercise, current task |
| **Current step**   | The Exercise step or Break step presently being presented when the Current phase is a Step.                        | Active exercise, current task |
| **Session Runner** | The domain coordinator that progresses the Session safely through Steps and Quick Rest transitions.                | Player, timer                 |
| **Completion**     | The normal end of a timed Step or Quick Rest, or the end of the final Step in a Session.                           | Finish, done                  |
| **Warning cue**    | The distinct sound emitted once at the configured Warning lead time before an eligible timed Step completes.       | Alert, pre-end beep           |
| **Completion cue** | The distinct sound signaling that an Exercise step, Break step, Quick Rest, or whole Session has completed.        | End beep, notification        |

## Session controls and state

| Term                    | Definition                                                                                           | Aliases to avoid          |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------- |
| **Start session**       | The deliberate action that captures the Session plan and begins its first Current phase.             | Play, launch              |
| **Pause**               | A temporary halt preserving the Current phase and its remaining or elapsed time.                     | Stop                      |
| **Resume**              | The action that continues a paused Session from its preserved Current phase.                         | Restart                   |
| **Finish step**         | The deliberate action that ends the current Exercise step or Break step before automatic Completion. | Skip exercise, skip break |
| **Skip Quick Rest**     | The deliberate action that ends the current Quick Rest before its Countdown completes.               | Finish break, skip Step   |
| **Stop session**        | The deliberate action that ends the entire Session and clears its active scheduling.                 | Pause, cancel step        |
| **Interrupted session** | A Session suspended because the application lost foreground status and requires an explicit Resume.  | Background session        |
| **Timed step**          | An Exercise step with a Duration or any Break step; it has a remaining-time Countdown.               | Countdown step            |
| **Open-ended step**     | An Exercise step without a Duration; it has Elapsed time and never completes automatically.          | Untimed step              |

## Runtime signals

| Term             | Definition                                                                                 | Aliases to avoid   |
| ---------------- | ------------------------------------------------------------------------------------------ | ------------------ |
| **Metronome**    | The audible Beat stream used to pace an Exercise with a Tempo.                             | Click track, timer |
| **Beat**         | One scheduled Metronome pulse at the Exercise's Tempo using the selected Metronome sound.  | Tick, click sound  |
| **Countdown**    | The displayed remaining time derived from a timed Step's or Quick Rest's planned end time. | Timer              |
| **Elapsed time** | The displayed time since an open-ended Step began, excluding paused time.                  | Duration           |
| **Stale event**  | A timer or audio callback for a phase that is no longer current and must be ignored.       | Duplicate event    |

## Relationships

- A **Routine** contains one or more ordered **Routine entries** and shared **Quick Rest Duration**, **Warning lead time**, and **Metronome sound** settings.
- A **Routine entry** is exactly one **Exercise** or **Break**.
- A **Break** may appear anywhere in a Routine, including beside another Break; a Routine containing only Breaks is valid.
- Deleting the final Routine entry creates one default **Exercise** so the Routine never remains empty.
- An **Exercise** derives exactly one **Exercise mode** from the presence or absence of **Tempo** and **Duration**.
- Starting a **Session** creates exactly one immutable **Session plan** from the selected Routine.
- A **Session plan** contains one **Exercise step** for each Exercise and one **Break step** for each Break, preserving Routine order.
- A positive **Quick Rest Duration** creates a **Quick Rest** only between two directly adjacent Exercise steps.
- A Quick Rest never occurs before or after a Break step and is not represented as a progress Step.
- A **Paced timed exercise** and a **Paced open-ended exercise** use a **Metronome**; other Exercise modes do not.
- Every **Timed step** and Quick Rest has a **Countdown**; every **Open-ended step** has **Elapsed time**.
- An eligible timed Exercise step or Break step receives at most one **Warning cue**; a Quick Rest never receives one.
- A paced timed Exercise's Warning cue aligns with the nearest **Beat** to its configured Warning lead point.
- A practitioner may override Tempo or Metronome sound during a Session without mutating its immutable Session plan; saving writes the choice to the Routine for later Sessions.

## Example dialogue

> **Dev:** “If I edit the **Tempo** while a **Session** is running, should the current **Exercise step** change?”
>
> **Domain expert:** “A session-only override may change the live **Metronome**. Saving updates the **Exercise** in the **Routine** for later Sessions; it does not mutate the captured **Session plan**.”
>
> **Dev:** “Does a **Paced open-ended exercise** get a **Countdown**?”
>
> **Domain expert:** “No. It uses the **Metronome** and shows **Elapsed time** until the practitioner chooses **Finish step**.”
>
> **Dev:** “Do we create a **Quick Rest** around a **Break**?”
>
> **Domain expert:** “No. A Quick Rest exists only between directly adjacent **Exercise steps**. The **Break step** is already an explicit part of the **Session plan**.”
>
> **Dev:** “Is a **Quick Rest** included in progress?”
>
> **Domain expert:** “No. It is a transition rather than a **Step**, so progress represents only Exercise steps and Break steps.”

## Flagged ambiguities

- The original prototype plan rejects an Exercise with Tempo but no Duration, while the implemented prototype and canonical model support it as a **Paced open-ended exercise**. Update any remaining supported-combinations tables and validation text during implementation.
- Older documents may use “break” for an automatically inserted rest. In the canonical language, an explicit saved Routine entry is a **Break** and the automatic transition is a **Quick Rest**.
- Use **Exercise** and **Break** for saved Routine entries, **Exercise step** and **Break step** for their captured Session execution, and **Quick Rest** only for the non-Step transition.
- Use **Finish step** for manually ending an Exercise step or Break step, **Skip Quick Rest** for ending a Quick Rest, and **Stop session** only for ending the entire Session.
- Use **Countdown**, **Elapsed time**, and **Stale event** instead of the overloaded word “timer.”
