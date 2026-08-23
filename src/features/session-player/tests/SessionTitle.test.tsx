import { describe, expect, it } from 'vitest'
import { fitSessionTitle } from '../SessionTitle/SessionTitle'

function titleThatFitsAt(limit: number) {
  const title = document.createElement('h1')
  Object.defineProperty(title, 'clientHeight', { value: 56 })
  Object.defineProperty(title, 'scrollHeight', {
    get: () => (Number.parseFloat(title.style.fontSize) <= limit ? 56 : 57),
  })
  return title
}

describe('SessionTitle', () => {
  it('keeps the preferred 48px size when the title fits', () => {
    const title = titleThatFitsAt(48)

    fitSessionTitle(title)

    expect(title.style.fontSize).toBe('48px')
  })

  it('uses the largest smoothly fitted font size', () => {
    const title = titleThatFitsAt(31.5)

    fitSessionTitle(title)

    expect(Number.parseFloat(title.style.fontSize)).toBeCloseTo(31.5, 1)
    expect(title.style.webkitLineClamp).toBe('')
  })

  it('clamps overflowing text at the 16px minimum', () => {
    const title = titleThatFitsAt(15)

    fitSessionTitle(title)

    expect(title.style.fontSize).toBe('16px')
    expect(title.style.webkitLineClamp).toBe('3')
  })
})
