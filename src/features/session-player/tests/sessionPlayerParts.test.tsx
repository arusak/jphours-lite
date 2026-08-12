import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StopSlider } from '../StopSlider/StopSlider'
import { TimerRing } from '../../../components'
import { formatTime } from '../formatTime'
import { stepMetadata } from '../stepMetadata'

describe('session player parts', () => {
  it('formats meaningful step metadata without a duration for open-ended exercises', () => {
    expect(formatTime(65)).toBe('1:05')
    expect(
      stepMetadata({
        id: 'open',
        kind: 'exercise',
        title: 'Improv',
        tempoBpm: 80,
        durationSec: null,
        sourceExerciseId: 'source',
      }),
    ).toBe('Improv · 80 BPM')
  })

  it('only stops when the slider reaches its configured threshold', () => {
    const onStop = vi.fn()
    render(<StopSlider onStop={onStop} />)
    const slider = screen.getByRole('slider', { name: /slide to stop/i })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(onStop).not.toHaveBeenCalled()
    fireEvent.keyDown(slider, { key: 'End' })
    expect(onStop).toHaveBeenCalledOnce()
  })

  it('renders supplied timer-ring content as children', () => {
    render(
      <TimerRing accessibleName="Remaining time: 0:30">
        <strong>0:30</strong>
        <span>Remaining time</span>
      </TimerRing>,
    )

    expect(screen.getByTestId('timer-ring')).toHaveAccessibleName('Remaining time: 0:30')
    expect(screen.getByText('0:30', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText('Remaining time', { selector: 'span' })).toBeInTheDocument()
  })
})
