import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { BottomSheet } from './BottomSheet'

function SheetHarness({ onSave = vi.fn() }: { onSave?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open sheet</button>
      <BottomSheet open={open} title="Example sheet" onClose={() => setOpen(false)}>
        <button
          onClick={() => {
            onSave()
            setOpen(false)
          }}
        >
          Save
        </button>
      </BottomSheet>
    </>
  )
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('BottomSheet', () => {
  it('keeps the dialog mounted through its exit animation and restores focus afterwards', () => {
    render(<SheetHarness />)
    const trigger = screen.getByRole('button', { name: 'Open sheet' })

    trigger.focus()
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Example sheet' })
    expect(document.body).toHaveClass('sheet-open')

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(dialog).toHaveAttribute('data-state', 'closing')
    expect(document.body).toHaveClass('sheet-open')
    fireEvent.animationEnd(dialog)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body).not.toHaveClass('sheet-open')
    expect(trigger).toHaveFocus()
  })

  it('ignores repeated close and action events while closing', () => {
    const onSave = vi.fn()
    render(<SheetHarness onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open sheet' }))
    const dialog = screen.getByRole('dialog', { name: 'Example sheet' })

    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(dialog).toHaveAttribute('data-state', 'closing')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('keeps its backdrop available to intercept pointer input while closing', () => {
    render(<SheetHarness />)
    fireEvent.click(screen.getByRole('button', { name: 'Open sheet' }))
    const dialog = screen.getByRole('dialog', { name: 'Example sheet' })

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(dialog.parentElement).toHaveAttribute('data-state', 'closing')
    expect(dialog.parentElement).not.toHaveStyle({ pointerEvents: 'none' })
  })

  it('runs an action once and retains its final payload until the exit ends', () => {
    const onSave = vi.fn()
    render(<SheetHarness onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open sheet' }))

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    const dialog = screen.getByRole('dialog', { name: 'Example sheet' })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledOnce()
    expect(dialog).toHaveAttribute('data-state', 'closing')
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('uses the timeout fallback when no animation event arrives', () => {
    vi.useFakeTimers()
    render(<SheetHarness />)
    const trigger = screen.getByRole('button', { name: 'Open sheet' })
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!)

    act(() => vi.advanceTimersByTime(240))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes and restores focus without waiting when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    render(<SheetHarness />)
    const trigger = screen.getByRole('button', { name: 'Open sheet' })
    trigger.focus()
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
