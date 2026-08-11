import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RegistrationProvider, useRegistation } from './RegistrationContext'

vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: vi.fn() }))

const updateServiceWorker = vi.fn<() => Promise<void>>()

function RegistrationStatus() {
  const { updateAvailable, update } = useRegistation()
  return (
    <button onClick={() => void update()}>
      {updateAvailable ? 'Update available' : 'Up to date'}
    </button>
  )
}

describe('RegistrationProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    updateServiceWorker.mockReset().mockResolvedValue(undefined)
    vi.mocked(useRegisterSW).mockReturnValue({
      needRefresh: [true, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker,
    })
  })

  afterEach(() => vi.useRealTimers())

  it('exposes update state and checks the registration immediately and hourly', () => {
    const { unmount } = render(
      <RegistrationProvider>
        <RegistrationStatus />
      </RegistrationProvider>,
    )
    const options = vi.mocked(useRegisterSW).mock.calls[0]![0]!
    const checkForUpdate = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const serviceWorkerRegistration = {
      update: checkForUpdate,
    } as unknown as ServiceWorkerRegistration

    act(() => options.onRegisteredSW?.('/sw.js', serviceWorkerRegistration))
    expect(checkForUpdate).toHaveBeenCalledOnce()

    act(() => vi.advanceTimersByTime(60 * 60 * 1000))
    expect(checkForUpdate).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Update available' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Update available' }))
    expect(updateServiceWorker).toHaveBeenCalledWith(true)

    unmount()
    act(() => vi.advanceTimersByTime(60 * 60 * 1000))
    expect(checkForUpdate).toHaveBeenCalledTimes(2)
  })
})
