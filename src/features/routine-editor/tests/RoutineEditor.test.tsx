import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createBreak, createExercise, createRoutine, type Routine } from '../../../domain/routine'
import type { RoutineRepository } from '../../../services/persistence/routine-repository'
import { RoutineEditor, routineTotal } from '../RoutineEditor/RoutineEditor'

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
    expect(screen.getByText('6 min')).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('button', { name: /session settings/i }))
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
    const disclosure = screen.getByRole('button', { name: /session settings/i })
    const panel = document.getElementById('routine-settings-panel')
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    expect(disclosure).toHaveTextContent('Quick Rest 30s · Warning cue Off · Wood')
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

    fireEvent.click(screen.getByRole('button', { name: /session settings/i }))
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
})
