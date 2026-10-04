import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TimerRing } from '../../../components'
import { formatTime } from '../formatTime'
import { stepMetadata } from '../stepMetadata'

describe('session player parts', () => {
  it('separates meaningful step metadata without a duration for open-ended exercises', () => {
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
    ).toEqual({ title: 'Improv', tempoBpm: 80, duration: null })
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
