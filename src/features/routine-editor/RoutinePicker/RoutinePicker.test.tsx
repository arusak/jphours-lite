import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createExercise, createRoutine } from '../../../domain/routine'
import { RoutinePicker } from './RoutinePicker'

const first = createRoutine({ name: 'Scales', entries: [createExercise({ durationSec: 60 })] })
const second = createRoutine({ name: 'Improv', entries: [createExercise({ durationSec: null })] })
const records = [
  { routine: first, lastAccessedAt: '2026-10-04T12:00:00.000Z' },
  { routine: second, lastAccessedAt: '2026-10-04T13:00:00.000Z' },
]
function setup(overrides: Partial<Parameters<typeof RoutinePicker>[0]> = {}) {
  const props = {
    routines: records,
    selectedRoutineId: first.id,
    error: null,
    onSelect: vi.fn().mockReturnValue(true),
    onCreate: vi.fn().mockReturnValue(true),
    onDelete: vi.fn().mockReturnValue(true),
    onRefresh: vi.fn(),
    ...overrides,
  }
  const view = render(<RoutinePicker {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Routines' }))
  return { ...props, ...view }
}

describe('RoutinePicker', () => {
  it('refreshes and displays routines by recency with totals and selected state', () => {
    const props = setup()
    expect(props.onRefresh).toHaveBeenCalledOnce()
    const buttons = screen.getAllByRole('button', { name: /Open routine/ })
    expect(buttons[0]).toHaveAccessibleName(/Improv/)
    expect(buttons[1]).toHaveAttribute('aria-current', 'true')
    expect(within(buttons[1]).getByText('1 min · Selected')).toBeInTheDocument()
    expect(within(buttons[0]).getByText(/Approximately/)).toBeInTheDocument()
  })

  it('keeps the drawer open after failed selection and closes after success', () => {
    const onSelect = vi.fn().mockReturnValueOnce(false).mockReturnValue(true)
    setup({ onSelect, error: 'Could not save. Try opening again.' })
    fireEvent.click(screen.getByRole('button', { name: 'Open routine Improv' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save')
    expect(screen.getByRole('dialog')).not.toHaveAttribute('data-state', 'closing')
    fireEvent.click(screen.getByRole('button', { name: 'Open routine Improv' }))
    expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'closing')
  })

  it('closes the selected row without recording another access', () => {
    const { onSelect } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Open routine Scales' }))
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'closing')
  })

  it('allows one deletion confirmation, cancellation and retry without closing', () => {
    const onDelete = vi.fn().mockReturnValueOnce(false).mockReturnValue(true)
    setup({ onDelete })
    fireEvent.click(screen.getByRole('button', { name: 'Delete routine Scales' }))
    expect(screen.queryByRole('button', { name: 'Open routine Scales' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete routine Improv' }))
    expect(screen.getAllByRole('slider')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Open routine Scales' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete routine Improv' }))
    const slider = screen.getByRole('slider', { name: 'Slide to delete routine Improv' })
    fireEvent.keyDown(slider, { key: 'End' })
    expect(onDelete).toHaveBeenLastCalledWith(second.id)
    expect(slider).toHaveAttribute('aria-valuenow', '0')
    fireEvent.keyDown(slider, { key: 'End' })
    expect(onDelete).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).not.toHaveAttribute('data-state', 'closing')
  })

  it('abandons deletion on Escape dismissal', () => {
    const { onDelete } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Delete routine Scales' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.animationEnd(screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: 'Routines' }))
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('keeps creation available below the cap and closes only on success', () => {
    const onCreate = vi.fn().mockReturnValueOnce(false).mockReturnValue(true)
    setup({ onCreate })
    fireEvent.click(screen.getByRole('button', { name: 'New routine' }))
    expect(screen.getByRole('dialog')).not.toHaveAttribute('data-state', 'closing')
    fireEvent.click(screen.getByRole('button', { name: 'New routine' }))
    expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'closing')
  })

  it('disables creation at capacity with an accessible explanation and enables it after deletion', () => {
    const routines = Array.from({ length: 100 }, (_, index) => ({
      routine: createRoutine({ name: `Routine ${index}` }),
      lastAccessedAt: records[0]!.lastAccessedAt,
    }))
    const props = setup({ routines })
    const create = screen.getByRole('button', { name: 'New routine' })
    expect(create).toBeDisabled()
    expect(create).toHaveAccessibleDescription(
      'You can save up to 100 routines. Delete a routine to add another.',
    )
    props.rerender(<RoutinePicker {...props} routines={routines.slice(1)} />)
    expect(screen.getByRole('button', { name: 'New routine' })).toBeEnabled()
  })

  it('preserves stored order for equal access timestamps', () => {
    setup({
      routines: records.map((record) => ({
        ...record,
        lastAccessedAt: records[0]!.lastAccessedAt,
      })),
    })
    expect(screen.getAllByRole('button', { name: /Open routine/ })[0]).toHaveAccessibleName(
      'Open routine Scales',
    )
  })

  it('focuses the confirmation slider and restores its delete button after Cancel', () => {
    setup()
    const deleteButton = screen.getByRole('button', { name: 'Delete routine Scales' })
    deleteButton.focus()
    fireEvent.click(deleteButton)
    expect(screen.getByRole('slider')).toHaveFocus()
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    cancel.focus()
    fireEvent.click(cancel)
    expect(screen.getByRole('button', { name: 'Delete routine Scales' })).toHaveFocus()
  })

  it('focuses the selected remaining routine after keyboard deletion succeeds', () => {
    function Picker() {
      const [routines, setRoutines] = useState(records)
      return (
        <RoutinePicker
          routines={routines}
          selectedRoutineId={second.id}
          error={null}
          onRefresh={() => {}}
          onSelect={() => true}
          onCreate={() => true}
          onDelete={(id) => {
            setRoutines((current) => current.filter((record) => record.routine.id !== id))
            return true
          }}
        />
      )
    }
    render(<Picker />)
    fireEvent.click(screen.getByRole('button', { name: 'Routines' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete routine Scales' }))
    const slider = screen.getByRole('slider')
    expect(slider).toHaveFocus()
    fireEvent.keyDown(slider, { key: 'End' })
    expect(screen.queryByRole('button', { name: 'Delete routine Scales' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open routine Improv' })).toHaveFocus()
  })
})
