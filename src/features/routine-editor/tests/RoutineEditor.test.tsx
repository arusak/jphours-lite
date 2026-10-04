import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createBreak, createExercise, createRoutine, type Routine } from '../../../domain/routine'
import {
  LocalStorageRoutineRepository,
  type RoutineRepository,
} from '../../../services/persistence/routine-repository'
import { RoutineEditor, routineTotal } from '../RoutineEditor/RoutineEditor'
import { serializeRoutineFile } from '../../../services/routine-files/routine-file'

vi.mock('../../../components', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../components')>()),
  AppUpdateBanner: () => null,
}))

function repository(initial: Routine): RoutineRepository {
  let collection = {
    storageVersion: 1 as const,
    selectedRoutineId: initial.id,
    routines: [{ routine: initial, lastAccessedAt: new Date().toISOString() }],
  }
  const repo: RoutineRepository = {
    load: (id = collection.selectedRoutineId) =>
      collection.routines.find((item) => item.routine.id === id)!.routine,
    loadCollection: () => collection,
    save: vi.fn((routine) => {
      collection = {
        ...collection,
        routines: collection.routines.map((item) =>
          item.routine.id === routine.id ? { ...item, routine } : item,
        ),
      }
    }),
    select: (id) => {
      collection = { ...collection, selectedRoutineId: id }
      return repo.load(id)
    },
    add: (routine) => {
      collection = {
        ...collection,
        selectedRoutineId: routine.id,
        routines: [...collection.routines, { routine, lastAccessedAt: new Date().toISOString() }],
      }
      return collection
    },
    remove: (id) => {
      const remaining = collection.routines.filter((item) => item.routine.id !== id)
      if (!remaining.length)
        remaining.push({ routine: createRoutine(), lastAccessedAt: new Date().toISOString() })
      collection = {
        ...collection,
        routines: remaining,
        selectedRoutineId: remaining.some(
          (item) => item.routine.id === collection.selectedRoutineId,
        )
          ? collection.selectedRoutineId
          : remaining[0].routine.id,
      }
      return collection
    },
  }
  return repo
}

describe('RoutineEditor', () => {
  function stored(...routines: Routine[]) {
    const bytes = new Map<string, string>()
    const repo = new LocalStorageRoutineRepository({
      getItem: (key) => bytes.get(key) ?? null,
      setItem: (key, value) => {
        bytes.set(key, value)
      },
    })
    repo.loadCollection()
    for (const routine of routines) repo.add(routine)
    return repo
  }

  it('creates immediately, reuses numbering gaps, and preserves edits before opening another Routine', () => {
    const first = createRoutine({ name: 'New routine' })
    const third = createRoutine({ name: 'New routine 3' })
    const repo = stored(first, third)
    render(<RoutineEditor repository={repo} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit routine name' }))
    fireEvent.change(screen.getByLabelText('Routine name'), { target: { value: 'Edited' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Routines' }))
    fireEvent.click(screen.getByRole('button', { name: 'New routine' }))
    expect(screen.getByRole('heading', { name: 'New routine 2', level: 1 })).toBeInTheDocument()
    expect(repo.load(third.id).name).toBe('Edited')
    expect(repo.loadCollection().routines).toHaveLength(4)
    expect(repo.load().entries).toHaveLength(1)
  })

  it('retains deletion confirmation after a failed write and retries without resurrecting a deleted Routine', () => {
    vi.useFakeTimers()
    const initial = createRoutine({ name: 'Selected' })
    const repo = stored(initial)
    const remove = vi.spyOn(repo, 'remove').mockImplementationOnce(() => {
      throw new Error('quota')
    })
    render(<RoutineEditor repository={repo} />)
    fireEvent.click(screen.getByRole('button', { name: 'Routines' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete routine Selected' }))
    fireEvent.keyDown(screen.getByRole('slider', { name: /Selected/ }), { key: 'End' })
    expect(screen.getByRole('slider', { name: /Selected/ })).toBeInTheDocument()
    expect(repo.load().id).toBe(initial.id)
    fireEvent.keyDown(screen.getByRole('slider', { name: /Selected/ }), { key: 'End' })
    act(() => vi.advanceTimersByTime(500))
    expect(remove).toHaveBeenCalledTimes(2)
    expect(repo.loadCollection().routines.some((item) => item.routine.id === initial.id)).toBe(
      false,
    )
    expect(screen.getByRole('dialog', { name: 'Routines' })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('disables creation and Import at capacity and restores them after deletion', () => {
    const repo = stored(
      ...Array.from({ length: 99 }, (_, index) => createRoutine({ name: `Routine ${index}` })),
    )
    render(<RoutineEditor repository={repo} />)
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Routines' }))
    expect(screen.getByRole('button', { name: 'New routine' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Delete routine Routine 98' }))
    fireEvent.keyDown(screen.getByRole('slider', { name: /Routine 98/ }), { key: 'End' })
    expect(screen.getByRole('button', { name: 'New routine' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled()
  })

  it('saves edits before switching and never lets the old debounce change selection', () => {
    vi.useFakeTimers()
    const first = createRoutine({ name: 'First' })
    const second = createRoutine({ name: 'Second' })
    const repo = stored(first, second)
    render(<RoutineEditor repository={repo} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit routine name' }))
    fireEvent.change(screen.getByLabelText('Routine name'), { target: { value: 'Pending second' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Routines' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open routine First' }))
    act(() => vi.advanceTimersByTime(500))
    expect(repo.load().id).toBe(first.id)
    expect(repo.load(second.id).name).toBe('Pending second')
    expect(screen.getByRole('heading', { name: 'First', level: 1 })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('rechecks capacity when confirming an already open import preview', async () => {
    const repo = stored()
    render(<RoutineEditor repository={repo} />)
    fireEvent.change(screen.getByLabelText('Choose Routine file'), {
      target: {
        files: [
          {
            size: 1000,
            text: () => Promise.resolve(serializeRoutineFile(createRoutine({ name: 'Imported' }))),
          },
        ],
      },
    })
    await screen.findByRole('dialog', { name: 'Import Routine' })
    for (let index = 0; index < 99; index++) repo.add(createRoutine({ name: `Routine ${index}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Add routine' }))
    expect(screen.getByRole('dialog', { name: 'Import Routine' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Practice routine', level: 1 })).toBeInTheDocument()
    expect(repo.loadCollection().routines).toHaveLength(100)
    expect(
      within(screen.getByRole('dialog', { name: 'Import Routine' })).getByRole('alert'),
    ).toHaveTextContent('could not be saved')
  })

  it('keeps background-save failures retryable and blocks Start session until edits save', () => {
    vi.useFakeTimers()
    const repo = stored(createRoutine({ name: 'Current' }))
    const save = vi.spyOn(repo, 'save').mockImplementation(() => {
      throw new Error('quota')
    })
    const start = vi.fn()
    render(<RoutineEditor repository={repo} onStartSession={start} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit routine name' }))
    fireEvent.change(screen.getByLabelText('Routine name'), { target: { value: 'Pending' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    act(() => vi.advanceTimersByTime(300))
    expect(screen.getByRole('alert')).toHaveTextContent('Check browser storage and retry')
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))
    expect(start).not.toHaveBeenCalled()
    save.mockRestore()
    fireEvent.click(screen.getByRole('button', { name: 'Retry saving' }))
    expect(repo.load().name).toBe('Pending')
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ name: 'Pending' }))
    vi.useRealTimers()
  })

  it('adopts a committed selection even if its summary refresh fails', () => {
    const first = createRoutine({ name: 'First' })
    const repo = stored(first, createRoutine({ name: 'Second' }))
    render(<RoutineEditor repository={repo} />)
    fireEvent.click(screen.getByRole('button', { name: 'Routines' }))
    const loadCollection = repo.loadCollection.bind(repo)
    const read = vi
      .spyOn(repo, 'loadCollection')
      .mockImplementationOnce(loadCollection)
      .mockImplementationOnce(loadCollection)
      .mockImplementationOnce(loadCollection)
      .mockImplementationOnce(() => {
        throw new Error('read unavailable')
      })
    fireEvent.click(screen.getByRole('button', { name: 'Open routine First' }))
    expect(screen.getByRole('heading', { name: 'First', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Routines' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('read unavailable')
    read.mockRestore()
    expect(repo.load().id).toBe(first.id)
  })

  it('adds a Break and restores a default Exercise after deletion', () => {
    render(
      <RoutineEditor
        repository={repository(createRoutine({ entries: [createExercise({ title: 'Scales' })] }))}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add break/i }))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByText('Break')).toBeInTheDocument()
    expect(screen.getByText('BPM')).toHaveClass('small-caps')
    fireEvent.click(screen.getByRole('button', { name: 'Delete Scales' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete Break' }))
    expect(screen.getByRole('heading', { name: 'Exercise' })).toBeInTheDocument()
  })

  it('edits exercise duration in whole minutes while retaining seconds', () => {
    const saved = vi.fn()
    const initial = createRoutine({
      entries: [createExercise({ title: 'Scales', durationSec: 300 })],
    })
    render(<RoutineEditor repository={{ ...repository(initial), save: saved }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Scales' }))
    const tempoUnit = screen
      .getAllByText('BPM')
      .find((element) => element.closest('[role="dialog"]'))
    expect(tempoUnit).toHaveClass('small-caps')
    fireEvent.change(screen.getAllByRole('spinbutton')[1], { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByLabelText('6 minutes')).toBeInTheDocument()
  })

  it('calculates eligible Quick Rests and marks open-ended totals approximate', () => {
    expect(
      routineTotal(
        createRoutine({
          quickRestDurationSec: 30,
          entries: [
            createExercise({ durationSec: null }),
            createExercise({ durationSec: 60 }),
            createBreak({ durationSec: 120 }),
          ],
        }),
      ),
    ).toEqual({ minutes: 9, approximate: true })
  })

  it('keeps the sheet field focused while typing', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    render(<RoutineEditor repository={repository(createRoutine())} />)
    fireEvent.click(screen.getByRole('button', { name: /add exercise/i }))
    const name = screen.getByLabelText(/exercise name/i)
    focus.mockClear()
    fireEvent.change(name, { target: { value: 'Scales' } })
    expect(name).toHaveFocus()
    expect(focus).not.toHaveBeenCalled()
    focus.mockRestore()
  })

  it('edits Metronome sound in the shared sheet without a save action', () => {
    render(<RoutineEditor repository={repository(createRoutine())} />)

    fireEvent.click(screen.getByRole('button', { name: /quick rest.*warning cue/i }))
    fireEvent.click(screen.getByRole('button', { name: /metronome sound/i }))
    expect(screen.getByRole('dialog', { name: 'Metronome sound' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Wood' }))

    expect(screen.getByRole('radio', { name: 'Wood' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('button', { name: 'Save sound' })).not.toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('button', { name: /metronome sound/i })).toHaveTextContent('Wood')
  })

  it('starts settings collapsed, exposes the current summary, and removes hidden controls from navigation', () => {
    render(
      <RoutineEditor
        repository={repository(
          createRoutine({
            quickRestDurationSec: 30,
            warningLeadTimeSec: 0,
            metronomeSound: 'wood',
          }),
        )}
      />,
    )
    const disclosure = screen.getByRole('button', { name: /quick rest.*warning cue/i })
    const panel = document.getElementById('routine-settings-panel')
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    expect(disclosure).toHaveTextContent('Quick Rest 30s · Warning cue Off · Wood Click')
    expect(panel).toHaveAttribute('aria-hidden', 'true')
    expect(panel).toHaveAttribute('inert')

    fireEvent.click(disclosure)

    expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    expect(panel).toHaveAttribute('aria-hidden', 'false')
    expect(panel).not.toHaveAttribute('inert')
    expect(screen.getByRole('button', { name: 'Increase Quick Rest' })).toBeInTheDocument()
  })

  it('auto-commits Alternate beat tone changes from the shared sound sheet', () => {
    render(<RoutineEditor repository={repository(createRoutine())} />)

    fireEvent.click(screen.getByRole('button', { name: /quick rest.*warning cue/i }))
    fireEvent.click(screen.getByRole('button', { name: /metronome sound/i }))
    const alternateBeatTone = screen.getByRole('switch', { name: 'Alternate beat tone' })
    expect(alternateBeatTone).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(alternateBeatTone)

    expect(alternateBeatTone).toHaveAttribute('aria-checked', 'false')
  })

  it('activates the dnd-kit Keyboard sensor only from the drag handle', async () => {
    render(
      <RoutineEditor
        repository={repository(createRoutine({ entries: [createExercise({ title: 'Scales' })] }))}
      />,
    )

    const handle = screen.getByRole('button', { name: 'Reorder Scales' })
    await waitFor(() => expect(handle).toHaveAttribute('aria-roledescription', 'draggable'))
    fireEvent.keyDown(handle, { code: 'Space' })
    await waitFor(() => expect(handle).toHaveAttribute('aria-grabbed', 'true'))
    fireEvent.keyDown(document, { code: 'Escape' })
    await waitFor(() => expect(handle).toHaveAttribute('aria-grabbed', 'false'))

    fireEvent.click(screen.getByRole('button', { name: 'Edit Scales' }))
    expect(screen.getByRole('dialog', { name: 'Edit exercise' })).toBeInTheDocument()
    expect(handle).toHaveAttribute('aria-grabbed', 'false')
  })

  it('previews Exercise names and total before adding a Routine', async () => {
    const saved = vi.fn()
    render(
      <RoutineEditor
        repository={{ ...repository(createRoutine({ name: 'Current' })), save: saved }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    const imported = createRoutine({
      name: 'Imported',
      entries: [
        createExercise({ title: 'Scales', durationSec: 300 }),
        createBreak({ durationSec: 60 }),
        createExercise({ title: 'Arpeggios', durationSec: 300 }),
      ],
      quickRestDurationSec: 0,
    })
    fireEvent.change(screen.getByLabelText('Choose Routine file'), {
      target: {
        files: [
          {
            size: 1_000,
            text: () => Promise.resolve(serializeRoutineFile(imported)),
          },
        ],
      },
    })

    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole('dialog', { name: 'Import Routine' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Imported', level: 3 })).toBeInTheDocument()
    expect(screen.getByText('Scales')).toBeInTheDocument()
    expect(screen.getByText('Arpeggios')).toBeInTheDocument()
    expect(screen.queryByText('Break')).not.toBeInTheDocument()
    expect(screen.getByText('11 min')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Current' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add routine' }))
    expect(screen.getByRole('heading', { name: 'Imported', level: 1 })).toBeInTheDocument()
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Current' }))
    expect(screen.getByRole('status')).toHaveTextContent('Routine imported.')
  })

  it('cancels an import preview without replacing or saving the current Routine', async () => {
    const saved = vi.fn()
    render(
      <RoutineEditor
        repository={{ ...repository(createRoutine({ name: 'Current' })), save: saved }}
      />,
    )
    const imported = createRoutine({ name: 'Imported' })

    fireEvent.click(screen.getByRole('button', { name: 'Edit routine name' }))
    fireEvent.change(screen.getByLabelText('Routine name'), { target: { value: 'Pending edit' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))

    fireEvent.change(screen.getByLabelText('Choose Routine file'), {
      target: {
        files: [
          {
            size: 1_000,
            text: () => Promise.resolve(serializeRoutineFile(imported)),
          },
        ],
      },
    })

    const preview = await screen.findByRole('dialog', { name: 'Import Routine' })
    fireEvent.click(within(preview).getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('heading', { name: 'Pending edit' })).toBeInTheDocument()
    expect(saved).not.toHaveBeenCalled()
  })

  it('reports a file read failure and keeps the current Routine', async () => {
    const saved = vi.fn()
    render(
      <RoutineEditor
        repository={{ ...repository(createRoutine({ name: 'Current' })), save: saved }}
      />,
    )

    fireEvent.change(screen.getByLabelText('Choose Routine file'), {
      target: {
        files: [
          {
            size: 1_000,
            text: () => Promise.reject(new Error('read failed')),
          },
        ],
      },
    })

    expect(await screen.findByRole('status')).toHaveTextContent(
      'The selected Routine file could not be read.',
    )
    expect(screen.getByRole('heading', { name: 'Current' })).toBeInTheDocument()
    expect(saved).not.toHaveBeenCalled()
  })

  it('ignores an older file read that finishes after a newer selection', async () => {
    let resolveOlder!: (text: string) => void
    let resolveNewer!: (text: string) => void
    const olderText = new Promise<string>((resolve) => (resolveOlder = resolve))
    const newerText = new Promise<string>((resolve) => (resolveNewer = resolve))
    render(<RoutineEditor repository={repository(createRoutine({ name: 'Current' }))} />)
    const input = screen.getByLabelText('Choose Routine file')

    fireEvent.change(input, {
      target: { files: [{ size: 1_000, text: () => olderText }] },
    })
    fireEvent.change(input, {
      target: { files: [{ size: 1_000, text: () => newerText }] },
    })
    await act(async () => resolveNewer(serializeRoutineFile(createRoutine({ name: 'Newer' }))))
    expect(screen.getByRole('heading', { name: 'Newer', level: 3 })).toBeInTheDocument()

    await act(async () => resolveOlder(serializeRoutineFile(createRoutine({ name: 'Older' }))))
    expect(screen.getByRole('heading', { name: 'Newer', level: 3 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Older' })).not.toBeInTheDocument()
  })

  it('reports an invalid import and keeps the current Routine', async () => {
    const saved = vi.fn()
    render(
      <RoutineEditor
        repository={{ ...repository(createRoutine({ name: 'Current' })), save: saved }}
      />,
    )

    fireEvent.change(screen.getByLabelText('Choose Routine file'), {
      target: {
        files: [{ size: 10, text: () => Promise.resolve('{invalid') }],
      },
    })

    expect(await screen.findByRole('status')).toHaveTextContent(
      'This is not a supported JP Hours Routine file.',
    )
    expect(screen.queryByRole('dialog', { name: 'Import Routine' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Current' })).toBeInTheDocument()
    expect(saved).not.toHaveBeenCalled()
  })

  it('keeps the current Routine and its pending save when an import cannot be persisted', async () => {
    vi.useFakeTimers()
    const save = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('storage unavailable')
      })
      .mockImplementation(() => undefined)
    render(
      <RoutineEditor repository={{ ...repository(createRoutine({ name: 'Current' })), save }} />,
    )
    const imported = createRoutine({ name: 'Imported' })

    fireEvent.click(screen.getByRole('button', { name: 'Edit routine name' }))
    fireEvent.change(screen.getByLabelText('Routine name'), { target: { value: 'Pending edit' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    fireEvent.change(screen.getByLabelText('Choose Routine file'), {
      target: {
        files: [
          {
            size: 1_000,
            text: () => Promise.resolve(serializeRoutineFile(imported)),
          },
        ],
      },
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole('dialog', { name: 'Import Routine' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add routine' }))

    expect(screen.getByRole('heading', { name: 'Pending edit' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Import Routine' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'The Routine could not be saved. Your current Routine was kept.',
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry saving' }))
    })
    expect(save).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: 'Pending edit' }))
    expect(save).toHaveBeenNthCalledWith(2, expect.objectContaining({ name: 'Pending edit' }))
    vi.useRealTimers()
  })

  it('cancels a stale pending save when an imported Routine is confirmed', async () => {
    vi.useFakeTimers()
    const saved = vi.fn()
    render(
      <RoutineEditor
        repository={{ ...repository(createRoutine({ name: 'Current' })), save: saved }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit routine name' }))
    fireEvent.change(screen.getByLabelText('Routine name'), { target: { value: 'Pending edit' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    const imported = createRoutine({ name: 'Imported' })
    fireEvent.change(screen.getByLabelText('Choose Routine file'), {
      target: {
        files: [
          {
            size: 1_000,
            text: () => Promise.resolve(serializeRoutineFile(imported)),
          },
        ],
      },
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole('dialog', { name: 'Import Routine' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add routine' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(saved).toHaveBeenCalledTimes(1)
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Pending edit' }))
    vi.useRealTimers()
  })

  it('exports a readable, identity-free Routine file with the sanitized filename', async () => {
    const createObjectURL = vi.fn(() => 'blob:routine')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    render(<RoutineEditor repository={repository(createRoutine({ name: 'Čello 👩‍🎤 / Warm-up' }))} />)

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('Routine exported.')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:routine')
    click.mockRestore()
    vi.unstubAllGlobals()
  })

  it('silently normalizes and truncates names entered in the editor', () => {
    render(<RoutineEditor repository={repository(createRoutine())} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit routine name' }))
    const name = screen.getByLabelText('Routine name')
    fireEvent.change(name, { target: { value: `A\u0000\u202E${'b'.repeat(100)}` } })
    expect(name).toHaveValue(`A ${'b'.repeat(58)}`)
  })

  it('explains schema-level Routine errors that disable actions', () => {
    render(<RoutineEditor repository={repository(createRoutine({ id: 'not-a-uuid' }))} />)

    expect(screen.getByRole('alert')).toHaveTextContent('This Routine contains invalid data.')
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Start session' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export' })).toHaveAttribute(
      'aria-describedby',
      'routine-validation-error',
    )
  })

  it('shows a setting-specific reason when validation disables actions', () => {
    render(<RoutineEditor repository={repository(createRoutine({ quickRestDurationSec: 7 }))} />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Use a Quick Rest duration in the configured range.',
    )
  })

  it('disables entry creation at the Routine entry limit', () => {
    render(
      <RoutineEditor
        repository={repository(
          createRoutine({
            entries: Array.from({ length: 1_000 }, (_, index) =>
              createExercise({ title: `Exercise ${index + 1}` }),
            ),
          }),
        )}
      />,
    )

    expect(screen.getByText('＋ Add exercise').closest('button')).toBeDisabled()
    expect(screen.getByText('＋ Add break').closest('button')).toBeDisabled()
    expect(screen.getByText('This Routine has reached the limit of 1,000 entries.')).toBeVisible()
  })
})
