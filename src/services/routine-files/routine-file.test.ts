import { describe, expect, it, vi } from 'vitest'
import { createBreak, createExercise, createRoutine } from '../../domain/routine'
import {
  parseRoutineFileText,
  routineFileName,
  ROUTINE_FILE_MAX_BYTES,
  serializeRoutineFile,
} from './routine-file'

describe('Routine file format', () => {
  it('round-trips without exporting local identity fields', () => {
    const source = createRoutine({
      name: 'Technique',
      entries: [createExercise({ title: 'Scales' }), createBreak()],
    })
    const text = serializeRoutineFile(source, new Date('2026-08-12T12:34:56.789Z'))
    expect(text.endsWith('\n')).toBe(true)
    expect(text).not.toContain(source.id)
    expect(text).not.toContain(source.entries[0]!.id)
    expect(text).not.toContain('updatedAt')
    expect(text).not.toContain('schemaVersion')

    const parsed = parseRoutineFileText(text)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.routine).toMatchObject({ name: 'Technique' })
    expect(parsed.routine.id).not.toBe(source.id)
    expect(parsed.routine.entries.map((entry) => entry.kind)).toEqual(['exercise', 'break'])
  })

  it('refuses to serialize a Routine that its own parser would reject', () => {
    expect(() => serializeRoutineFile(createRoutine({ quickRestDurationSec: -1 }))).toThrow(
      'Cannot export an invalid Routine.',
    )
  })

  it('serializes the version 1 transfer shape exactly', () => {
    const routine = createRoutine({
      name: 'Timing',
      entries: [
        createExercise({ title: 'Triplets', tempoBpm: 120, durationSec: null }),
        createBreak({ durationSec: 60 }),
      ],
      quickRestDurationSec: 15,
      warningLeadTimeSec: 5,
      metronomeSound: 'wood',
      alternateBeatTone: false,
    })

    expect(JSON.parse(serializeRoutineFile(routine, new Date('2026-08-12T12:34:56.789Z')))).toEqual(
      {
        format: 'jphours-routine',
        formatVersion: 1,
        exportedAt: '2026-08-12T12:34:56.789Z',
        routine: {
          name: 'Timing',
          entries: [
            { kind: 'exercise', title: 'Triplets', tempoBpm: 120, durationSec: null },
            { kind: 'break', durationSec: 60 },
          ],
          quickRestDurationSec: 15,
          warningLeadTimeSec: 5,
          metronomeSound: 'wood',
          alternateBeatTone: false,
        },
      },
    )
  })

  it('assigns fresh local identity and the import timestamp', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-12T16:00:00.000Z'))
    const source = createRoutine({
      entries: [createExercise({ title: 'One' }), createExercise({ title: 'Two' })],
    })

    const parsed = parseRoutineFileText(serializeRoutineFile(source))

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.routine.updatedAt).toBe('2026-08-12T16:00:00.000Z')
      expect(parsed.routine.id).not.toBe(source.id)
      expect(parsed.routine.entries.map(({ id }) => id)).not.toEqual(
        source.entries.map(({ id }) => id),
      )
      expect(new Set(parsed.routine.entries.map(({ id }) => id)).size).toBe(2)
    }
    vi.useRealTimers()
  })

  it('normalizes hostile title formatting, keeps emoji, and defaults empty names', () => {
    const source = createRoutine({
      name: '\u202E  ',
      entries: [
        createExercise({ title: 'A\u0000\u202EB 👩‍🎤 e\u0301' }),
        createExercise({ title: '\u0000' }),
      ],
    })
    const parsed = parseRoutineFileText(serializeRoutineFile(source))
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.routine.name).toBe('Practice routine')
    expect(parsed.routine.entries[0]).toMatchObject({ title: 'A B 👩‍🎤 é' })
    expect(parsed.routine.entries[1]).toMatchObject({ title: 'Exercise' })
  })

  it('enforces name and entry boundaries', () => {
    const sixty = 'a'.repeat(60)
    const routine = createRoutine({
      name: `${sixty}overflow`,
      entries: Array.from({ length: 1_000 }, (_, index) =>
        createExercise({ title: index === 0 ? `${sixty}overflow` : `Exercise ${index}` }),
      ),
    })
    const parsed = parseRoutineFileText(serializeRoutineFile(routine))
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.routine.name).toHaveLength(60)
      expect(parsed.routine.entries).toHaveLength(1_000)
      expect(parsed.routine.entries[0]).toMatchObject({ title: sixty })
    }

    const tooMany = JSON.parse(serializeRoutineFile(routine))
    tooMany.routine.entries.push(tooMany.routine.entries[0])
    expect(parseRoutineFileText(JSON.stringify(tooMany)).success).toBe(false)
  })

  it.each([
    ['unknown top-level keys', (value: any) => (value.junk = true)],
    ['unknown Routine keys', (value: any) => (value.routine.junk = true)],
    ['unknown entry keys', (value: any) => (value.routine.entries[0].junk = true)],
    ['wrong kind', (value: any) => (value.routine.entries[0].kind = 'other')],
    ['invalid tempo', (value: any) => (value.routine.entries[0].tempoBpm = 999)],
    ['bogus timestamp', (value: any) => (value.exportedAt = '2026-99-99T00:00:00.000Z')],
    ['timestamp without milliseconds', (value: any) => (value.exportedAt = '2026-08-12T00:00:00Z')],
    ['unsupported version', (value: any) => (value.formatVersion = 2)],
  ])('rejects %s', (_name, mutate) => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const value = JSON.parse(serializeRoutineFile(createRoutine()))
    mutate(value)
    expect(parseRoutineFileText(JSON.stringify(value)).success).toBe(false)
    expect(console.warn).toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('explains an unsupported integer format version', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const value = JSON.parse(serializeRoutineFile(createRoutine()))
    value.formatVersion = 2

    expect(parseRoutineFileText(JSON.stringify(value))).toEqual({
      success: false,
      message: 'This JP Hours Routine file uses unsupported format version 2.',
    })
    vi.restoreAllMocks()
  })

  it('rejects prototype-pollution-shaped and deeply nested unknown fields', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const value = serializeRoutineFile(createRoutine()).replace(
      '"routine": {',
      '"routine": { "__proto__": { "polluted": true }, "junk": { "deep": { "value": 1 } },',
    )
    expect(parseRoutineFileText(value).success).toBe(false)
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
    vi.restoreAllMocks()
  })

  it('rejects malformed and oversized JSON before schema parsing', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(parseRoutineFileText('{').success).toBe(false)
    expect(parseRoutineFileText('x'.repeat(ROUTINE_FILE_MAX_BYTES + 1)).success).toBe(false)
    vi.restoreAllMocks()
  })

  it('applies the byte limit to UTF-8 bytes rather than JavaScript code units', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const text = 'é'.repeat(ROUTINE_FILE_MAX_BYTES / 2 + 1)
    expect(text.length).toBeLessThan(ROUTINE_FILE_MAX_BYTES)
    expect(parseRoutineFileText(text)).toEqual({
      success: false,
      message: 'This is not a supported JP Hours Routine file.',
    })
    expect(console.warn).toHaveBeenCalledWith('Routine import validation failed', {
      issues: [{ path: '', code: 'file_too_large' }],
    })
    vi.restoreAllMocks()
  })

  it('creates a Unicode filename without emoji or filesystem punctuation', () => {
    expect(routineFileName('Čello 👩‍🎤 / Warm-up')).toBe('JPHours_Čello_Warmup.json')
  })
})
