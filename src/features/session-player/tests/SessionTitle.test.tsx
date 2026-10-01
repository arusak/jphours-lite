import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionTitle } from '../SessionTitle/SessionTitle'

describe('SessionTitle', () => {
  it('preserves the full Exercise title in an h1 with its width factor', () => {
    const { getByRole } = render(<SessionTitle title="Любой рудимент" />)
    const heading = getByRole('heading', { level: 1 })

    expect(heading.textContent).toBe('Любой рудимент')
    expect(Number(heading.style.getPropertyValue('--title-width-factor'))).toBeCloseTo(8.4)
  })

  it('updates the width factor for each Current phase without inline pixel sizing', () => {
    const { getByRole, rerender } = render(<SessionTitle title="Любой рудимент" />)

    rerender(<SessionTitle title="Break" />)
    const heading = getByRole('heading', { level: 1 })
    expect(heading.textContent).toBe('Break')
    expect(Number(heading.style.getPropertyValue('--title-width-factor'))).toBeCloseTo(3)
    expect(heading.style.fontSize).toBe('')

    rerender(<SessionTitle title="A longer Exercise title" />)
    expect(heading.textContent).toBe('A longer Exercise title')
    expect(Number(heading.style.getPropertyValue('--title-width-factor'))).toBeCloseTo(13.8)
    expect(heading.style.fontSize).toBe('')
  })

  it('uses a nonzero denominator for an empty title', () => {
    const { getByRole } = render(<SessionTitle title="" />)
    const heading = getByRole('heading', { level: 1 })

    expect(heading.textContent).toBe('')
    expect(Number(heading.style.getPropertyValue('--title-width-factor'))).toBeCloseTo(0.6)
  })

  it('counts a supplementary Unicode character as one code point', () => {
    const { getByRole } = render(<SessionTitle title="🎵" />)
    const heading = getByRole('heading', { level: 1 })

    expect(heading.textContent).toBe('🎵')
    expect(Number(heading.style.getPropertyValue('--title-width-factor'))).toBeCloseTo(0.6)
  })

  it('renders and changes titles without reading geometry or constructing a ResizeObserver', () => {
    for (const property of ['scrollHeight', 'clientHeight'] as const) {
      vi.spyOn(Element.prototype, property, 'get').mockImplementation(() => {
        throw new Error(`SessionTitle must not read ${property}`)
      })
    }
    const resizeObserver = vi.fn(function () {
      return { observe: vi.fn(), disconnect: vi.fn() }
    })
    vi.stubGlobal('ResizeObserver', resizeObserver)

    const { rerender } = render(<SessionTitle title="Любой рудимент" />)
    rerender(<SessionTitle title="Break" />)
    rerender(<SessionTitle title="Quick Rest" />)

    expect(resizeObserver).not.toHaveBeenCalled()
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
