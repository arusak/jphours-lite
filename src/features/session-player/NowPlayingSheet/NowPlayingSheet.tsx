import { BottomSheet } from '../../../components'
import type { SessionStep } from '../../../domain/session'
import { stepMetadata } from '../stepMetadata'
import styles from './NowPlayingSheet.module.css'

interface NowPlayingSheetProps {
  open: boolean
  steps: SessionStep[]
  currentIndex: number
  quickRest: boolean
  onClose(): void
}
export function NowPlayingSheet({
  open,
  steps,
  currentIndex,
  quickRest,
  onClose,
}: NowPlayingSheetProps) {
  return (
    <BottomSheet open={open} title="Now Playing" onClose={onClose}>
      <ol className={styles.nowPlayingList}>
        {steps.map((item, itemIndex) => (
          <li
            key={item.id}
            data-current={(itemIndex === currentIndex && !quickRest) || undefined}
            data-up-next={(itemIndex === currentIndex + 1 && quickRest) || undefined}
          >
            <strong>{stepMetadata(item)}</strong>
            {itemIndex === currentIndex && !quickRest && <span>Current</span>}
            {itemIndex === currentIndex + 1 && quickRest && <span>Up next</span>}
          </li>
        ))}
      </ol>
    </BottomSheet>
  )
}
