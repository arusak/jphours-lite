import type { CSSProperties } from 'react'
import styles from './SessionTitle.module.css'

interface SessionTitleProps {
  title: string
}

export function SessionTitle({ title }: SessionTitleProps) {
  // ponytail: average width can misestimate wide glyphs or multi-code-point graphemes; revisit fitting if clipping is observed.
  const style = {
    '--title-width-factor': 0.6 * Math.max(1, Array.from(title).length),
  } as CSSProperties

  return (
    <h1 className={styles.title} style={style}>
      {title}
    </h1>
  )
}
