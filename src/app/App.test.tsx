import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoutine } from '../domain/routine'
import { App } from './App'

const fixtureRoutine = createRoutine()
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
  LocalStorageRoutineRepository: class {},
}))
vi.mock('../features/routine-editor/RoutineEditor/RoutineEditor', () => ({
  RoutineEditor: ({
    onStartSession,
  }: {
    onStartSession?(routine: typeof fixtureRoutine): void
  }) => <button onClick={() => onStartSession?.(fixtureRoutine)}>Start session</button>,
}))
vi.mock('../features/session-player/SessionPlayer/SessionPlayer', () => ({
  SessionPlayer: ({ onExit }: { onExit(): void }) => {
    calls.push('session-player')
    return <button onClick={onExit}>Exit session</button>
  },
}))

describe('App', () => {
  beforeEach(() => {
    calls.length = 0
    vi.clearAllMocks()
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
})
