import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import styles from './BottomSheet.module.css'

interface BottomSheetProps {
  open: boolean
  title: string
  children: ReactNode
  onClose(): void
  onAfterClose?(): void
}

type Presence = 'closed' | 'opening' | 'open' | 'closing'

const closeFallbackMs = 240
const focusable =
  "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])"

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export function BottomSheet({ open, title, children, onClose, onAfterClose }: BottomSheetProps) {
  const [presence, setPresence] = useState<Presence>(open ? 'opening' : 'closed')
  const sheet = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const presenceRef = useRef(presence)
  const opener = useRef<HTMLElement | null>(null)
  const presented = useRef({ title, children })
  const closeRequested = useRef(false)
  const afterClosePending = useRef(false)
  const onAfterCloseRef = useRef(onAfterClose)
  onCloseRef.current = onClose
  onAfterCloseRef.current = onAfterClose
  presenceRef.current = presence
  if (open) presented.current = { title, children }

  const completeClose = () => {
    afterClosePending.current = true
    setPresence((current) => (current === 'closing' ? 'closed' : current))
  }

  useLayoutEffect(() => {
    if (open) {
      closeRequested.current = false
      afterClosePending.current = false
      if (opener.current === null)
        opener.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (presenceRef.current === 'closed' || presenceRef.current === 'closing') {
        setPresence('opening')
      }
      return
    }
    if (presenceRef.current === 'closed' || presenceRef.current === 'closing') return
    if (prefersReducedMotion()) {
      afterClosePending.current = true
      setPresence('closed')
      return
    }
    setPresence('closing')
  }, [open])

  useEffect(() => {
    if (presence !== 'closing') return
    const element = sheet.current
    const onExitAnimation = (event: AnimationEvent) => {
      if (event.target === element) completeClose()
    }
    const fallback = window.setTimeout(completeClose, closeFallbackMs)
    element?.addEventListener('animationend', onExitAnimation)
    return () => {
      window.clearTimeout(fallback)
      element?.removeEventListener('animationend', onExitAnimation)
    }
  }, [presence])

  useEffect(() => {
    if (presence !== 'closed' || !afterClosePending.current) return
    afterClosePending.current = false
    onAfterCloseRef.current?.()
  }, [presence])

  useLayoutEffect(() => {
    if (presence === 'closed') return
    document.body.classList.add('sheet-open')
    sheet.current?.querySelector<HTMLElement>(focusable)?.focus()
    return () => {
      document.body.classList.remove('sheet-open')
      opener.current?.focus()
      opener.current = null
    }
  }, [presence === 'closed'])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (presenceRef.current === 'closed') return
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!closeRequested.current && presenceRef.current !== 'closing') {
          closeRequested.current = true
          onCloseRef.current()
        }
        return
      }
      if (event.key !== 'Tab' || !sheet.current) return
      const items = [...sheet.current.querySelectorAll<HTMLElement>(focusable)]
      if (!items.length) return
      const firstItem = items[0]
      const lastItem = items.at(-1)!
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  if (presence === 'closed') return null
  const snapshot = presented.current
  const titleId = `sheet-${snapshot.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const closing = presence === 'closing'
  return (
    <div
      className={styles.sheetBackdrop}
      data-state={presence}
      onMouseDown={(event) => {
        if (!closing && event.target === event.currentTarget && !closeRequested.current) {
          closeRequested.current = true
          onCloseRef.current()
        }
      }}
    >
      <div
        ref={sheet}
        className={styles.bottomSheet}
        data-state={presence}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onAnimationEnd={(event) => {
          if (event.target !== event.currentTarget) return
          if (event.currentTarget.dataset.state === 'opening') setPresence('open')
          if (event.currentTarget.dataset.state === 'closing') completeClose()
        }}
        onClickCapture={(event) => {
          if (presenceRef.current === 'closing') {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
        onKeyDownCapture={(event) => {
          if (presenceRef.current === 'closing' && event.key !== 'Tab') {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
      >
        <div className={styles.sheetGrabber} />
        <h2 id={titleId}>{snapshot.title}</h2>
        {snapshot.children}
      </div>
    </div>
  )
}
