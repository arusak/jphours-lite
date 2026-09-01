import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createBreak, createExercise, createRoutine, type Routine } from '../../../domain/routine'
import type { RoutineRepository } from '../../../services/persistence/routine-repository'
import { RoutineEditor, routineTotal } from '../RoutineEditor/RoutineEditor'
import { serializeRoutineFile } from '../../../services/routine-files/routine-file'

vi.mock('../../../components', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../components')>()),
  AppUpdateBanner: () => null,
}))

function repository(initial: Routine): RoutineRepository {
  return { load: () => initial, save: vi.fn() }
}

describe('RoutineEditor', () => {
  it('adds a Break and restores a default Exercise after deletion', () => {
    render(
      <RoutineEditor
        repository={repository(createRoutine({ entries: [createExercise({ title: 'Scales' })] }))}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add break/i }))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByText('Break')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Scales' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete Break' }))
    expect(screen.getByRole('heading', { name: 'Exercise' })).toBeInTheDocument()
  })

  it('edits exercise duration in whole minutes while retaining seconds', () => {
    const saved = vi.fn()
    const initial = createRoutine({
      entries: [createExercise({ title: 'Scales', durationSec: 300 })],
    })
    render(<RoutineEditor repository={{ load: () => initial, save: saved }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Scales' }))
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

  it('previews Exercise names and total before replacing the current Routine', async () => {
    const saved = vi.fn()
    render(
      <RoutineEditor
        repository={{ load: () => createRoutine({ name: 'Current' }), save: saved }}
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

    fireEvent.click(screen.getByRole('button', { name: 'Replace Routine' }))
    expect(screen.getByRole('heading', { name: 'Imported', level: 1 })).toBeInTheDocument()
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Imported' }))
    expect(screen.getByRole('status')).toHaveTextContent('Routine imported.')
  })

  it('cancels an import preview without replacing or saving the current Routine', async () => {
    const saved = vi.fn()
    render(
      <RoutineEditor
        repository={{ load: () => createRoutine({ name: 'Current' }), save: saved }}
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
        repository={{ load: () => createRoutine({ name: 'Current' }), save: saved }}
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
        repository={{ load: () => createRoutine({ name: 'Current' }), save: saved }}
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
    render(<RoutineEditor repository={{ load: () => createRoutine({ name: 'Current' }), save }} />)
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

    fireEvent.click(screen.getByRole('button', { name: 'Replace Routine' }))

    expect(screen.getByRole('heading', { name: 'Pending edit' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Import Routine' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'The Routine could not be saved. Your current Routine was kept.',
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(save).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: 'Imported' }))
    expect(save).toHaveBeenNthCalledWith(2, expect.objectContaining({ name: 'Pending edit' }))
    vi.useRealTimers()
  })

  it('cancels a stale pending save when an imported Routine is confirmed', async () => {
    vi.useFakeTimers()
    const saved = vi.fn()
    render(
      <RoutineEditor
        repository={{ load: () => createRoutine({ name: 'Current' }), save: saved }}
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
    fireEvent.click(screen.getByRole('button', { name: 'Replace Routine' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(saved).toHaveBeenCalledTimes(1)
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Imported' }))
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
