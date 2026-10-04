import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SlideToConfirm } from './SlideToConfirm'

describe('SlideToConfirm', () => {
  it('confirms at the configured threshold and supports retry after failure', () => {
    const onConfirm = vi.fn().mockReturnValueOnce(false).mockReturnValue(true)
    render(
      <SlideToConfirm
        label="Slide to delete"
        accessibleName="Delete Scales"
        icon={<span />}
        threshold={0.8}
        onConfirm={onConfirm}
      />,
    )
    const slider = screen.getByRole('slider', { name: 'Delete Scales' })
    for (let i = 0; i < 7; i++) fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(slider).toHaveAttribute('aria-valuenow', '0')
    fireEvent.keyDown(slider, { key: 'End' })
    fireEvent.keyDown(slider, { key: 'End' })
    expect(onConfirm).toHaveBeenCalledTimes(2)
  })

  it('only confirms a completed pointer gesture across the threshold', () => {
    const onConfirm = vi.fn()
    render(
      <SlideToConfirm
        label="Slide to stop"
        accessibleName="Slide to stop"
        icon={<span />}
        threshold={0.8}
        onConfirm={onConfirm}
      />,
    )
    const slider = screen.getByRole('slider')
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 256 } as DOMRect)
    const pointer = (name: string, clientX: number) =>
      fireEvent(slider, new MouseEvent(name, { bubbles: true, clientX }))
    pointer('pointerdown', 204)
    pointer('pointerup', 204)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(slider).toHaveAttribute('aria-valuenow', '0')
    pointer('pointerdown', 4)
    pointer('pointerup', 4)
    expect(onConfirm).not.toHaveBeenCalled()
    pointer('pointerdown', 4)
    pointer('pointermove', 204)
    expect(onConfirm).not.toHaveBeenCalled()
    pointer('pointercancel', 204)
    pointer('pointerup', 204)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(slider).toHaveAttribute('aria-valuenow', '0')
    pointer('pointerdown', 4)
    pointer('pointerup', 104)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(slider).toHaveAttribute('aria-valuenow', '0')
    pointer('pointerdown', 4)
    pointer('pointerup', 164)
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('supports keyboard reset, reverse movement and incomplete blur', () => {
    const onConfirm = vi.fn()
    render(
      <SlideToConfirm
        label="Slide to stop"
        accessibleName="Slide to stop"
        icon={<span />}
        threshold={0.8}
        onConfirm={onConfirm}
      />,
    )
    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowUp' })
    fireEvent.keyDown(slider, { key: 'ArrowUp' })
    fireEvent.keyDown(slider, { key: 'ArrowDown' })
    expect(slider).toHaveAttribute('aria-valuenow', '10')
    fireEvent.blur(slider)
    expect(slider).toHaveAttribute('aria-valuenow', '0')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    fireEvent.keyDown(slider, { key: 'Home' })
    expect(slider).toHaveAttribute('aria-valuenow', '0')
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
