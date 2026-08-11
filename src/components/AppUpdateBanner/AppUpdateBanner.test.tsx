import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RegistrationProvider } from '../../services/platform/RegistrationContext'
import { AppUpdateBanner } from './AppUpdateBanner'

const registration = vi.hoisted(() => ({
  updateAvailable: false,
  update: vi.fn<() => Promise<void>>(),
}))

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [registration.updateAvailable, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: registration.update,
  }),
}))

describe('AppUpdateBanner', () => {
  beforeEach(() => {
    registration.updateAvailable = false
    registration.update.mockReset().mockResolvedValue(undefined)
  })

  it('runs pending work before accepting an available update', async () => {
    registration.updateAvailable = true
    const onBeforeUpdate = vi.fn()

    render(
      <RegistrationProvider>
        <AppUpdateBanner onBeforeUpdate={onBeforeUpdate} />
      </RegistrationProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => expect(registration.update).toHaveBeenCalledOnce())
    expect(onBeforeUpdate).toHaveBeenCalledOnce()
    expect(onBeforeUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      registration.update.mock.invocationCallOrder[0]!,
    )
  })
})
