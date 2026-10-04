import { fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoutine } from '../domain/routine'
import { App } from './App'

const fixtureRoutine = createRoutine()
const secondRoutine = createRoutine({ name: 'Second routine' })
let storedRoutines = [fixtureRoutine, secondRoutine]
let selectedId = fixtureRoutine.id
let sessionCallbacks: {
  onSaveTempo(id: string, tempo: number): void
  onSaveMetronomeSound(sound: 'wood'): void
  onSaveAlternateBeatTone(enabled: boolean): void
}
const repository = {
  load: vi.fn((id = selectedId) => {
    const routine = storedRoutines.find((routine) => routine.id === id)
    if (!routine) throw new Error('Routine no longer exists.')
    return routine
  }),
  select: vi.fn((id: string) => {
    selectedId = id
    return repository.load(id)
  }),
  save: vi.fn((routine: typeof fixtureRoutine) => {
    storedRoutines = storedRoutines.map((stored) => (stored.id === routine.id ? routine : stored))
  }),
}
const calls: string[] = []
const audio = {
  ensureRunning: vi.fn(() => {
    calls.push('ensureRunning')
    return Promise.resolve(true)
  }),
  dispose: vi.fn(() => calls.push('dispose')),
}

vi.mock('../services/audio', () => ({
  AudioController: class {
    constructor() {
      return audio
    }
  },
}))
vi.mock('../services/persistence/routine-repository', () => ({
  LocalStorageRoutineRepository: class {
    constructor() {
      return repository
    }
  },
}))
vi.mock('../features/routine-editor/RoutineEditor/RoutineEditor', () => ({
  RoutineEditor: ({
    onStartSession,
  }: {
    onStartSession?(routine: typeof fixtureRoutine): void
  }) => <button onClick={() => onStartSession?.(fixtureRoutine)}>Start session</button>,
}))
vi.mock('../features/session-player/SessionPlayer/SessionPlayer', () => ({
  SessionPlayer: (props: typeof sessionCallbacks & { onExit(): void }) => {
    sessionCallbacks = props
    calls.push('session-player')
    return <button onClick={props.onExit}>Exit session</button>
  },
}))

describe('App', () => {
  beforeEach(() => {
    calls.length = 0
    vi.clearAllMocks()
    storedRoutines = [fixtureRoutine, secondRoutine]
    selectedId = fixtureRoutine.id
  })
  afterEach(() => vi.clearAllMocks())

  it('begins audio activation in the Start session gesture before showing the Session Player', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))

    expect(audio.ensureRunning).toHaveBeenCalledOnce()
    expect(calls).toEqual(['ensureRunning', 'session-player'])
  })

  it('disposes the owned controller when the active Session exits', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))
    fireEvent.click(screen.getByRole('button', { name: 'Exit session' }))

    expect(audio.dispose).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Start session' })).toBeInTheDocument()
  })

  it('disposes the owned controller when the app unmounts during an active Session', () => {
    const { unmount } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))

    unmount()

    expect(audio.dispose).toHaveBeenCalledOnce()
  })

  it('records startup access once under StrictMode and does not repeat it after a Session', () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    expect(repository.select).toHaveBeenCalledExactlyOnceWith(fixtureRoutine.id)
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))
    fireEvent.click(screen.getByRole('button', { name: 'Exit session' }))
    expect(repository.select).toHaveBeenCalledOnce()
  })

  it('blocks the editor after an initialization failure and retries startup restoration', () => {
    repository.select.mockImplementationOnce(() => {
      throw new Error('Storage unavailable.')
    })
    render(<App />)
    expect(screen.getByRole('alert')).toHaveTextContent('Storage unavailable.')
    expect(screen.queryByRole('button', { name: 'Start session' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.getByRole('button', { name: 'Start session' })).toBeInTheDocument()
    expect(repository.select).toHaveBeenCalledTimes(2)
  })

  it('saves all Session settings only to its captured source Routine without recording access', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))
    selectedId = secondRoutine.id
    repository.select.mockClear()
    repository.load.mockClear()

    sessionCallbacks.onSaveTempo(fixtureRoutine.entries[0]!.id, 91)
    sessionCallbacks.onSaveMetronomeSound('wood')
    sessionCallbacks.onSaveAlternateBeatTone(false)

    expect(repository.load.mock.calls).toEqual([
      [fixtureRoutine.id],
      [fixtureRoutine.id],
      [fixtureRoutine.id],
    ])
    expect(storedRoutines[0]).toMatchObject({ metronomeSound: 'wood', alternateBeatTone: false })
    expect(storedRoutines[0]!.entries[0]).toMatchObject({ tempoBpm: 91 })
    expect(storedRoutines[1]).toEqual(secondRoutine)
    expect(selectedId).toBe(secondRoutine.id)
    expect(repository.select).not.toHaveBeenCalled()
    expect(fixtureRoutine.alternateBeatTone).toBe(true)
    expect(fixtureRoutine.entries[0]).not.toMatchObject({ tempoBpm: 91 })
  })

  it('rejects all saves when the Session source is missing without falling back to selection', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))
    storedRoutines = [secondRoutine]
    selectedId = secondRoutine.id

    expect(() => sessionCallbacks.onSaveTempo(fixtureRoutine.entries[0]!.id, 91)).toThrow(
      'Routine no longer exists.',
    )
    expect(() => sessionCallbacks.onSaveMetronomeSound('wood')).toThrow('Routine no longer exists.')
    expect(() => sessionCallbacks.onSaveAlternateBeatTone(false)).toThrow(
      'Routine no longer exists.',
    )
    expect(repository.save).not.toHaveBeenCalled()
    expect(storedRoutines).toEqual([secondRoutine])
  })
})
