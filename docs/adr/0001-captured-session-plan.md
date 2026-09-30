# Capture the Session plan and derive Exercise modes

A Routine is an editable practice design; a Session executes its captured plan. Starting a Session copies ordered Routine entries into Exercise steps and Break steps. A positive Quick Rest Duration creates transition metadata only between directly adjacent Exercise steps. Quick Rest is never a Step, so progress and Now Playing represent practitioner-authored entries rather than automatically inserted rests. Explicit Breaks remain Steps, including consecutive Breaks and Break-only Routines.

Tempo and Duration are independently optional. Their presence derives four Exercise modes: both present, Duration only, Tempo only, or neither present. An Exercise with Tempo but no Duration is a valid Paced open-ended exercise and continues until Finish step. This supersedes the older rejection of that combination. The mode is derived rather than stored as an additional Session field.

Live Tempo, Metronome sound, and Alternate beat tone changes use overrides without rewriting the captured plan. Tempo is saved to the Routine only through Save; sound and alternate tone changes save automatically. Later Sessions capture the saved choices. Immutability is a usage contract for the captured plan, not runtime freezing, and does not imply restoration after reload.

Implementation:

- [Session-plan construction](../../src/services/session/buildSessionSteps.ts), [Session overrides](../../src/features/session-player/hooks/useSessionPlayer.ts), and [Routine save callbacks](../../src/app/App.tsx).
- [Session-plan and progression tests](../../src/services/session/session.test.ts).
