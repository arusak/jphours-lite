import { createExercise, createRoutine, type Exercise, type Routine } from '../../domain/routine'

export const RANDOM_ROUTINE_ADJECTIVES = [
  'Bitter',
  'Blunt',
  'Bold',
  'Brisk',
  'Cold',
  'Crooked',
  'Crisp',
  'Dark',
  'Dead',
  'Dry',
  'Stubborn',
  'Flat',
  'Reckless',
  'Lean',
  'Loose',
  'Loud',
  'Lopsided',
  'Mean',
  'Odd',
  'Restless',
  'Proud',
  'Raw',
  'Rough',
  'Sharp',
  'Slick',
  'Sly',
  'Smug',
  'Stiff',
  'Tight',
  'Wry',
] as const

export const RANDOM_ROUTINE_NOUNS = [
  'Beat',
  'Bass',
  'Brass',
  'Click',
  'Clave',
  'Clap',
  'Crash',
  'Drum',
  'Fill',
  'Funk',
  'Gong',
  'Groove',
  'Shuffle',
  'Rimshot',
  'Horn',
  'Jam',
  'Jazz',
  'Kick',
  'Loop',
  'Backbeat',
  'Note',
  'Pulse',
  'Offbeat',
  'Rest',
  'Riff',
  'Roll',
  'Snare',
  'Stomp',
  'Swing',
  'Cowbell',
] as const

export const RANDOM_ROUTINE_EXERCISE_NAMES = [
  'Offbeat Lock',
  'Dotted Pulse',
  'Downbeat Drop',
  'Three Against Two',
  'Swing Switch',
  'Accent Pyramid',
  'Accent Carousel',
  'Beat Displacement',
  'Rhythm Mirror',
  'Subdivision Switch',
  'Three-Note Loop',
  'Unison Break',
  'Missing Downbeat',
  'Five-Note Loop',
  'Double-Time Feel',
  'Backbeat Snap',
  'Syncopation Ladder',
  'Half-Time Pocket',
  'Triplet Weave',
  'Offbeat Triplets',
  'Triplet Accents',
  'Sixteenth Sprint',
  'Quarter-Note Triplets',
  'Sixteenth Gaps',
  'Ghost Notes',
  'Sixteenth Shuffle',
  'Two-Bar Echo',
  'Accent Flip',
  'Rest Rotation',
  'Rhythm Inversion',
] as const

const randomIndex = (length: number) => Math.floor(Math.random() * length)

function shuffle<T>(source: readonly T[]): T[] {
  const result = [...source]
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = randomIndex(index + 1)
    ;[result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!]
  }
  return result
}

export function createBlankRoutine(name: string): Routine {
  return createRoutine({
    name,
    entries: [createExercise({ title: 'Practice', durationSec: 300, tempoBpm: 100 })],
  })
}

export function createRandomRoutine(): Routine {
  const name = `${RANDOM_ROUTINE_ADJECTIVES[randomIndex(RANDOM_ROUTINE_ADJECTIVES.length)]!} ${RANDOM_ROUTINE_NOUNS[randomIndex(RANDOM_ROUTINE_NOUNS.length)]!}`
  const titles = shuffle(RANDOM_ROUTINE_EXERCISE_NAMES).slice(0, 5)
  const durations = shuffle([180, 180, 240, 300, 300])
  const tempos = shuffle([80, 90, 100, 110, 120])

  if (isMonotonic(tempos)) [tempos[1], tempos[2]] = [tempos[2]!, tempos[1]!]

  const entries: Exercise[] = titles.map((title, index) =>
    createExercise({ title, durationSec: durations[index]!, tempoBpm: tempos[index]! }),
  )
  return createRoutine({ name, entries, quickRestDurationSec: 5 })
}

function isMonotonic(values: number[]): boolean {
  return (
    values.every((value, index) => index === 0 || value > values[index - 1]!) ||
    values.every((value, index) => index === 0 || value < values[index - 1]!)
  )
}
