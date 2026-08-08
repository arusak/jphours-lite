import source from './practice.yml'

type NumberPolicy = { default: number; min: number; max: number; increment: number }
export type MetronomeSound = 'classic' | 'wood' | 'digital'

export interface PracticeConfig {
  tempo: NumberPolicy
  exerciseDuration: NumberPolicy
  breakDuration: NumberPolicy
  quickRestDuration: NumberPolicy
  warningLeadTime: NumberPolicy
  metronome: {
    defaultSound: MetronomeSound
    sounds: Record<MetronomeSound, { waveform: OscillatorType; frequency: number; decay: number }>
  }
  audio: { beatPeak: number; warningPeak: number; completionPeak: number }
  interaction: { slideToStopThreshold: number }
}

function numberPolicy(value: unknown, name: string): NumberPolicy {
  if (typeof value !== 'object' || value === null)
    throw new Error(`${name} configuration is missing.`)
  const candidate = value as Record<string, unknown>
  const keys = ['default', 'min', 'max', 'increment'] as const
  if (keys.some((key) => !Number.isFinite(candidate[key]))) {
    throw new Error(`${name} configuration must contain finite numeric bounds.`)
  }
  const policy = Object.fromEntries(keys.map((key) => [key, candidate[key]])) as NumberPolicy
  if (policy.min > policy.default || policy.default > policy.max || policy.increment <= 0) {
    throw new Error(`${name} configuration has invalid bounds.`)
  }
  return policy
}

function parseConfig(value: unknown): PracticeConfig {
  if (typeof value !== 'object' || value === null)
    throw new Error('Practice configuration is invalid.')
  const config = value as Record<string, unknown>
  const metronome = config.metronome as Record<string, unknown> | undefined
  const sounds = metronome?.sounds as Record<string, unknown> | undefined
  const soundNames: MetronomeSound[] = ['classic', 'wood', 'digital']
  if (!metronome || !sounds || !soundNames.every((name) => typeof sounds[name] === 'object')) {
    throw new Error('Metronome sound configuration is invalid.')
  }
  const parsedSounds = Object.fromEntries(
    soundNames.map((name) => {
      const sound = sounds[name] as Record<string, unknown>
      if (
        !['sine', 'triangle', 'square', 'sawtooth'].includes(String(sound.waveform)) ||
        !Number.isFinite(sound.frequency) ||
        !Number.isFinite(sound.decay)
      )
        throw new Error(`Metronome sound ${name} is invalid.`)
      return [
        name,
        {
          waveform: sound.waveform as OscillatorType,
          frequency: Number(sound.frequency),
          decay: Number(sound.decay),
        },
      ]
    }),
  ) as PracticeConfig['metronome']['sounds']
  const audio = config.audio as Record<string, unknown> | undefined
  const interaction = config.interaction as Record<string, unknown> | undefined
  if (
    !audio ||
    !interaction ||
    !['beatPeak', 'warningPeak', 'completionPeak'].every((key) => Number.isFinite(audio[key])) ||
    !Number.isFinite(interaction.slideToStopThreshold)
  ) {
    throw new Error('Audio or interaction configuration is invalid.')
  }
  if (
    Object.values(audio).some((level) => Number(level) < 0 || Number(level) > 1) ||
    Number(interaction.slideToStopThreshold) <= 0 ||
    Number(interaction.slideToStopThreshold) > 1
  ) {
    throw new Error('Audio or interaction configuration is out of bounds.')
  }
  const defaultSound = metronome.defaultSound
  if (!soundNames.includes(defaultSound as MetronomeSound))
    throw new Error('Default metronome sound is invalid.')
  return {
    tempo: numberPolicy(config.tempo, 'Tempo'),
    exerciseDuration: numberPolicy(config.exerciseDuration, 'Exercise duration'),
    breakDuration: numberPolicy(config.breakDuration, 'Break duration'),
    quickRestDuration: numberPolicy(config.quickRestDuration, 'Quick Rest duration'),
    warningLeadTime: numberPolicy(config.warningLeadTime, 'Warning lead time'),
    metronome: { defaultSound: defaultSound as MetronomeSound, sounds: parsedSounds },
    audio: {
      beatPeak: Number(audio.beatPeak),
      warningPeak: Number(audio.warningPeak),
      completionPeak: Number(audio.completionPeak),
    },
    interaction: { slideToStopThreshold: Number(interaction.slideToStopThreshold) },
  }
}

export const practiceConfig = parseConfig(source)
export const validatePracticeConfig = parseConfig
