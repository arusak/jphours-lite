import { useState } from 'react'
import { useRegistation } from '../../services/platform/RegistrationContext'
import styles from './AppUpdateBanner.module.css'

interface AppUpdateBannerProps {
  onBeforeUpdate?(): void
}

export function AppUpdateBanner({ onBeforeUpdate }: AppUpdateBannerProps) {
  const { updateAvailable, update } = useRegistation()
  const [updating, setUpdating] = useState(false)

  if (!updateAvailable) return null

  const acceptUpdate = async () => {
    if (updating) return
    setUpdating(true)
    try {
      onBeforeUpdate?.()
      await update()
    } catch {
      setUpdating(false)
    }
  }

  return (
    <aside className={styles.banner} aria-label="Application update available">
      <p>A new version is ready.</p>
      <button className={styles.action} disabled={updating} onClick={acceptUpdate}>
        {updating ? 'Updating…' : 'Update'}
      </button>
    </aside>
  )
}
