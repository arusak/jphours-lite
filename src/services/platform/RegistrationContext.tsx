import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface Registration {
  updateAvailable: boolean
  update(): Promise<void>
}

const RegistrationContext = createContext<Registration | null>(null)

export function RegistrationProvider({ children }: PropsWithChildren) {
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const {
    needRefresh: [updateAvailable],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_swScriptUrl, serviceWorkerRegistration) => {
      registration.current = serviceWorkerRegistration
      void serviceWorkerRegistration?.update()
    },
  })

  useEffect(() => {
    const updateInterval = window.setInterval(
      () => {
        void registration.current?.update()
      },
      60 * 60 * 1000,
    )
    return () => window.clearInterval(updateInterval)
  }, [])

  const update = useCallback(() => updateServiceWorker(true), [updateServiceWorker])
  const value = useMemo(() => ({ updateAvailable, update }), [updateAvailable, update])

  return <RegistrationContext.Provider value={value}>{children}</RegistrationContext.Provider>
}

export function useRegistation(): Registration {
  const registration = useContext(RegistrationContext)
  if (!registration) {
    throw new Error('useRegistation must be used within RegistrationProvider')
  }
  return registration
}
