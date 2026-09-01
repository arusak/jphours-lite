import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBreak, createExercise, createRoutine } from '../../../domain/routine'
import { SessionPlayer } from '../SessionPlayer/SessionPlayer'

const silentBeatSnapshot = {
  beatIndex: -1,
  positionInPattern: 0,
  accent: 'primary' as const,
  audioTime: null,
  tempoBpm: null,
  running: false,
  generation: 0,
}
let audioSnapshot: {
  status: 'running' | 'activating' | 'unavailable' | 'idle'
  generation: number
} = {
  status: 'running',
  generation: 1,
}
const audio = {
  ensureRunning: vi.fn().mockResolvedValue(true),
  startMetronome: vi.fn(),
  updateMetronomeTempo: vi.fn(),
  updateMetronomeSound: vi.fn(),
  updateAlternateBeatTone: vi.fn(),
  scheduleWarningAt: vi.fn(),
  stopMetronome: vi.fn(),
  playCue: vi.fn(),
  dispose: vi.fn(),
  subscribeToBeats: vi.fn(() => vi.fn()),
  getBeatSnapshot: vi.fn(() => silentBeatSnapshot),
  subscribeToState: vi.fn(() => vi.fn()),
  getStateSnapshot: vi.fn(() => audioSnapshot),
}
vi.mock('../../../services/audio', () => ({
  AudioController: class {
    constructor() {
      return audio
    }
  },
}))
vi.mock('../../../services/platform/wakeLock', () => ({
  WakeLockController: class {
    acquire = vi.fn()
    release = vi.fn()
  },
}))
vi.mock('../../../services/platform/visibilityLifecycle', () => ({
  observeVisibility: vi.fn(() => vi.fn()),
}))

const routineWith = (...entries: ReturnType<typeof createExercise>[]) => createRoutine({ entries })

describe('SessionPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    audioSnapshot = { status: 'running', generation: 1 }
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('puts tempo controls in the paced exercise ring and saves a divergent tempo', async () => {
    const onSaveTempo = vi.fn()
    render(
      <SessionPlayer
        routine={routineWith(createExercise({ id: 'scales', title: 'Scales', tempoBpm: 90 }))}
        onExit={vi.fn()}
        onSaveTempo={onSaveTempo}
      />,
    )
    expect(await screen.findByText('90', { selector: 'strong' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Increase tempo' }))
    expect(screen.getByText('91', { selector: 'strong' })).toBeInTheDocument()
    expect(audio.updateMetronomeTempo).toHaveBeenCalledWith(91)
    fireEvent.click(screen.getByRole('button', { name: 'Save tempo' }))
    expect(onSaveTempo).toHaveBeenCalledWith('scales', 91)
  })

  it('auto-commits a live Metronome sound change from the sound sheet', async () => {
    const onSaveMetronomeSound = vi.fn()
    render(
      <SessionPlayer
        routine={routineWith(createExercise({ id: 'scales', title: 'Scales', tempoBpm: 90 }))}
        onExit={vi.fn()}
        onSaveMetronomeSound={onSaveMetronomeSound}
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Choose metronome sound' }))
    expect(screen.getByRole('dialog', { name: 'Metronome sound' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Classic' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: 'Wood' }))
    expect(audio.updateMetronomeSound).toHaveBeenCalledWith('wood')
    expect(onSaveMetronomeSound).toHaveBeenCalledWith('wood')
    expect(screen.getByRole('radio', { name: 'Wood' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('button', { name: 'Save sound' })).not.toBeInTheDocument()
  })

  it('auto-commits an Alternate beat tone change from the sound sheet', async () => {
    const onSaveAlternateBeatTone = vi.fn()
    render(
      <SessionPlayer
        routine={routineWith(createExercise({ id: 'scales', title: 'Scales', tempoBpm: 90 }))}
        onExit={vi.fn()}
        onSaveAlternateBeatTone={onSaveAlternateBeatTone}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Choose metronome sound' }))
    const alternateBeatTone = screen.getByRole('switch', { name: 'Alternate beat tone' })
    fireEvent.click(alternateBeatTone)

    expect(alternateBeatTone).toHaveAttribute('aria-checked', 'false')
    expect(audio.updateAlternateBeatTone).toHaveBeenCalledWith(false)
    expect(onSaveAlternateBeatTone).toHaveBeenCalledWith(false)
  })

  it('uses the neutral, accessible elapsed-time ring for an unpaced open-ended exercise', async () => {
    render(
      <SessionPlayer
        routine={routineWith(
          createExercise({ title: 'Improv', tempoBpm: null, durationSec: null }),
        )}
        onExit={vi.fn()}
      />,
    )
    const ring = await screen.findByTestId('timer-ring')
    expect(ring).toHaveAttribute('data-open-ended', 'true')
    expect(ring).toHaveAccessibleName(/elapsed time/i)
    expect(screen.getByTestId('exercise-icon')).toBeInTheDocument()
  })

  it('structures the next exercise title and metadata separately', async () => {
    const longTitle = 'A deliberately long exercise name that needs truncating'
    render(
      <SessionPlayer
        routine={routineWith(
          createExercise({ title: 'One' }),
          createExercise({ title: longTitle, tempoBpm: 96, durationSec: 90 }),
        )}
        onExit={vi.fn()}
      />,
    )

    expect(await screen.findByText('Up next')).toBeInTheDocument()
    expect(screen.getByText(longTitle)).toHaveAttribute('title', longTitle)
    expect(within(screen.getByTestId('timer-ring')).getByText('BPM')).toHaveClass('small-caps')
    const nextTempo = screen
      .getAllByText('BPM')
      .find((element) => element.parentElement?.textContent === '96 BPM · 1:30')
    expect(nextTempo).toBeDefined()
    expect(nextTempo).toHaveClass('small-caps')
    expect(nextTempo?.parentElement).toHaveTextContent('96 BPM · 1:30')
  })

  it('opens a read-only Now Playing list of meaningful steps and bypasses Quick Rest on Finish step', async () => {
    const one = createExercise({ id: 'one', title: 'One', durationSec: 30 })
    const two = createExercise({ id: 'two', title: 'Two', durationSec: 30 })
    render(<SessionPlayer routine={routineWith(one, two)} onExit={vi.fn()} />)
    await screen.findByRole('heading', { name: 'One' })
    fireEvent.click(screen.getByRole('button', { name: /now playing/i }))
    const nowPlaying = await screen.findByRole('dialog', { name: 'Now Playing' })
    const currentStep = within(nowPlaying).getByText(
      (_, element) =>
        element?.tagName === 'STRONG' && element.textContent === 'One · 80 BPM · 0:30',
    )
    expect(currentStep).toBeInTheDocument()
    expect(within(currentStep).getByText('BPM')).toHaveClass('small-caps')
    expect(screen.queryByText(/Quick Rest/)).not.toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Finish step' }))
    expect(await screen.findByRole('heading', { name: 'Two' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /now playing/i }))
    const reopenedNowPlaying = await screen.findByRole('dialog', { name: 'Now Playing' })
    expect(within(reopenedNowPlaying).getByText('Current')).toBeInTheDocument()
  })

  it('presents the four media controls and only stops after slide confirmation', async () => {
    const onExit = vi.fn()
    render(
      <SessionPlayer routine={routineWith(createExercise({ title: 'One' }))} onExit={onExit} />,
    )
    await screen.findByRole('heading', { name: 'One' })
    const rewindButton = screen.getByRole('button', { name: 'Rewind' })
    expect(rewindButton).toBeInTheDocument()
    expect(rewindButton.querySelector('svg')).toHaveAttribute('viewBox', '0 0 24 24')
    const pauseButton = screen.getByRole('button', { name: 'Pause session' })
    expect(pauseButton).toBeInTheDocument()
    expect(pauseButton.querySelector('svg')).toHaveAttribute('fill', 'currentColor')
    fireEvent.click(pauseButton)
    expect(
      screen.getByRole('button', { name: 'Resume session' }).querySelector('svg'),
    ).toHaveAttribute('fill', 'currentColor')
    const forwardButton = screen.getByRole('button', { name: 'Finish step' })
    expect(forwardButton.querySelector('svg')).toHaveAttribute('viewBox', '0 0 24 24')
    const stopButton = screen.getByRole('button', { name: 'Stop session' })
    expect(stopButton.querySelector('svg')).toHaveAttribute('fill', 'currentColor')
    fireEvent.click(stopButton)
    const slider = await screen.findByRole('slider', { name: /slide to stop/i })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    fireEvent.blur(slider)
    expect(screen.queryByText('Session stopped')).not.toBeInTheDocument()
    fireEvent.keyDown(slider, { key: 'End' })
    expect(onExit).not.toHaveBeenCalled()
    fireEvent.animationEnd(screen.getByRole('dialog', { name: 'Stop session' }))
    expect(onExit).toHaveBeenCalledOnce()
    expect(screen.queryByText('Session stopped')).not.toBeInTheDocument()
  })

  it('renders a Break as a meaningful dark-accent ring', async () => {
    const breakEntry = createBreak({ id: 'break', durationSec: 60 })
    render(<SessionPlayer routine={createRoutine({ entries: [breakEntry] })} onExit={vi.fn()} />)
    expect(await screen.findByRole('heading', { name: 'Break' })).toBeInTheDocument()
    expect(screen.getByTestId('timer-ring')).toHaveAttribute('data-tone', 'break')
    expect(screen.getByTestId('break-icon')).toBeInTheDocument()
  })

  it('keeps paced timed progress visible and frozen while paused', async () => {
    vi.useFakeTimers()
    render(
      <SessionPlayer
        routine={routineWith(createExercise({ title: 'Scales', tempoBpm: 90, durationSec: 10 }))}
        onExit={vi.fn()}
      />,
    )
    await act(async () => Promise.resolve())
    act(() => vi.advanceTimersByTime(3_000))
    fireEvent.click(screen.getByRole('button', { name: 'Pause session' }))

    const ring = screen.getByTestId('timer-ring')
    const progress = ring.querySelectorAll('circle')[1]
    expect(ring).toHaveAttribute('data-open-ended', 'false')
    expect(progress).toBeDefined()
    const offset = progress.getAttribute('stroke-dashoffset')
    act(() => vi.advanceTimersByTime(3_000))
    expect(progress).toHaveAttribute('stroke-dashoffset', offset!)
  })

  it('navigates while paused without resuming or restarting the Metronome', async () => {
    const one = createExercise({ id: 'one', title: 'One', tempoBpm: 90, durationSec: 10 })
    const two = createExercise({ id: 'two', title: 'Two', tempoBpm: 90, durationSec: 10 })
    render(<SessionPlayer routine={routineWith(one, two)} onExit={vi.fn()} />)
    await screen.findByRole('heading', { name: 'One' })
    audio.startMetronome.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Pause session' }))
    fireEvent.click(screen.getByRole('button', { name: 'Finish step' }))
    expect(await screen.findByRole('heading', { name: 'Two' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume session' })).toBeInTheDocument()
    expect(audio.startMetronome).not.toHaveBeenCalled()
    expect(screen.getByTestId('timer-ring').querySelectorAll('circle')[1]).toHaveAttribute(
      'stroke-dashoffset',
      expect.stringMatching(/^804\.2477/),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Rewind' }))
    expect(await screen.findByRole('heading', { name: 'One' })).toBeInTheDocument()
    expect(audio.playCue).not.toHaveBeenCalledWith('session-complete')
  })

  it('shows a paced TimerRing at Completion before presenting the Completion screen', async () => {
    vi.useFakeTimers()
    let showCompletionScreen: FrameRequestCallback | undefined
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        showCompletionScreen = callback
        return 1
      }),
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    render(
      <SessionPlayer
        routine={routineWith(createExercise({ title: 'Scales', tempoBpm: 90, durationSec: 1 }))}
        onExit={vi.fn()}
      />,
    )

    await act(async () => Promise.resolve())
    act(() => vi.advanceTimersByTime(1_000))

    const ring = screen.getByTestId('timer-ring')
    expect(ring).toHaveAttribute('data-discrete-progress', 'true')
    expect(ring.querySelectorAll('circle')[1]).toHaveAttribute('stroke-dashoffset', '0')
    expect(screen.queryByText('Routine complete')).not.toBeInTheDocument()

    act(() => showCompletionScreen?.(0))
    expect(screen.getByText('Routine complete')).toBeInTheDocument()
  })

  it('keeps the Current phase visible and lets the practitioner retry unavailable audio', async () => {
    audioSnapshot = { status: 'unavailable', generation: 1 }
    render(
      <SessionPlayer
        routine={routineWith(createExercise({ title: 'Scales', tempoBpm: 90 }))}
        onExit={vi.fn()}
      />,
    )

    expect(await screen.findByRole('heading', { name: 'Scales' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Audio is unavailable. Timers and controls still work.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry audio' }))
    expect(audio.ensureRunning).toHaveBeenCalledOnce()
  })

  it('shows audio activation without replacing Session controls', async () => {
    audioSnapshot = { status: 'activating', generation: 1 }
    render(
      <SessionPlayer
        routine={routineWith(createExercise({ title: 'Scales', tempoBpm: 90 }))}
        onExit={vi.fn()}
      />,
    )

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Starting audio… Timers and controls still work.',
    )
    expect(screen.getByRole('button', { name: 'Pause session' })).toBeInTheDocument()
  })
})
