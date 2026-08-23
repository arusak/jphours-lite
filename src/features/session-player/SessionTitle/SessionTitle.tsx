import { useLayoutEffect, useRef } from 'react'
import styles from './SessionTitle.module.css'

const minFontSize = 16
const maxFontSize = 48
const lineHeight = 1.05

export function fitSessionTitle(element: HTMLHeadingElement) {
  const fits = (fontSize: number) => {
    element.style.fontSize = `${fontSize}px`
    return element.scrollHeight <= element.clientHeight
  }

  element.style.removeProperty('-webkit-line-clamp')
  if (fits(maxFontSize)) return

  let smallestFit = minFontSize
  let largestOverflow = maxFontSize
  for (let iteration = 0; iteration < 10; iteration += 1) {
    const candidate = (smallestFit + largestOverflow) / 2
    if (fits(candidate)) smallestFit = candidate
    else largestOverflow = candidate
  }

  element.style.fontSize = `${Math.floor(smallestFit * 100) / 100}px`
  if (element.scrollHeight > element.clientHeight) {
    element.style.setProperty(
      '-webkit-line-clamp',
      String(Math.max(1, Math.floor(element.clientHeight / (minFontSize * lineHeight)))),
    )
  }
}

interface SessionTitleProps {
  title: string
}

export function SessionTitle({ title }: SessionTitleProps) {
  const heading = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const element = heading.current
    if (!element) return
    const fit = () => fitSessionTitle(element)
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [title])

  return (
    <h1 ref={heading} className={styles.title}>
      {title}
    </h1>
  )
}
