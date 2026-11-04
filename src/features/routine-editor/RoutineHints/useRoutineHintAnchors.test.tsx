import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useRoutineHintAnchors } from './useRoutineHintAnchors'

afterEach(() => vi.restoreAllMocks())

it('keeps compact annotations, refreshes on resize/scroll, omits invisible targets and cleans up', () => {
  vi.stubGlobal('innerHeight', 568)
  vi.stubGlobal('innerWidth', 320)
  const editor = document.createElement('section')
  const card = document.createElement('article')
  const edit = document.createElement('button')
  card.append(edit)
  const add = document.createElement('button')
  const settings = document.createElement('button')
  editor.append(settings, card, add)
  let addTop = 400
  let cardTop = 220
  let editTop = 250
  const rect = (x: number, y: number, width: number, height: number) => ({
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON() {},
  })
  vi.spyOn(editor, 'getBoundingClientRect').mockImplementation(() => rect(0, 0, 320, 568))
  vi.spyOn(card, 'getBoundingClientRect').mockImplementation(() => rect(16, cardTop, 288, 80))
  vi.spyOn(edit, 'getBoundingClientRect').mockImplementation(() => rect(250, editTop, 40, 40))
  vi.spyOn(settings, 'getBoundingClientRect').mockImplementation(() => rect(16, 150, 288, 40))
  vi.spyOn(add, 'getBoundingClientRect').mockImplementation(() => rect(16, addTop, 140, 44))
  const disconnect = vi.fn()
  let resize!: ResizeObserverCallback
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback
      }
      observe() {}
      disconnect = disconnect
    },
  )
  const remove = vi.spyOn(window, 'removeEventListener')
  const targets = {
    containerRef: { current: editor },
    addExerciseRef: { current: add },
    settingsRef: { current: settings },
    editExerciseRef: { current: edit },
  }
  const { result, unmount } = renderHook(() => useRoutineHintAnchors(targets))
  expect(result.current.map(({ key }) => key)).toEqual(['settings', 'edit', 'add'])
  expect(result.current.map(({ top }) => top)).toEqual([194, 312, 368])
  // Curves must approach their target without overshooting and curling back.
  for (const { path } of result.current) {
    const [sx, sy, cx1, cy1, cx2, cy2, ex, ey] = path.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    for (const x of [cx1!, cx2!]) expect(x).toBeGreaterThanOrEqual(Math.min(sx!, ex!))
    for (const x of [cx1!, cx2!]) expect(x).toBeLessThanOrEqual(Math.max(sx!, ex!))
    for (const y of [cy1!, cy2!]) expect(y).toBeGreaterThanOrEqual(Math.min(sy!, ey!))
    for (const y of [cy1!, cy2!]) expect(y).toBeLessThanOrEqual(Math.max(sy!, ey!))
  }
  editTop = -50
  act(() => window.dispatchEvent(new Event('scroll')))
  expect(result.current.map(({ key }) => key)).not.toContain('edit')
  editTop = 240
  act(() => window.dispatchEvent(new Event('resize')))
  expect(result.current.map(({ key }) => key)).toContain('edit')
  cardTop = 300
  editTop = 330
  act(() => window.dispatchEvent(new Event('resize')))
  expect(result.current.map(({ top }) => top)).toEqual([194, 222, 250])
  expect(result.current.every(({ top }) => top + 24 <= 400)).toBe(true)
  const editLabel = result.current.find(({ key }) => key === 'edit')!
  expect(editLabel.left + editLabel.width).toBeLessThan(250)
  expect(editLabel.top + 24).toBeLessThanOrEqual(cardTop)
  const labels = result.current
  for (const [index, label] of labels.entries()) {
    for (const other of labels.slice(index + 1)) {
      expect(
        label.top + 24 <= other.top ||
          other.top + 24 <= label.top ||
          label.left + label.width <= other.left ||
          other.left + other.width <= label.left,
      ).toBe(true)
    }
  }
  editTop = -50
  act(() => resize([], {} as ResizeObserver))
  expect(result.current.map(({ key }) => key)).not.toContain('edit')
  cardTop = 220
  addTop = 320
  act(() => window.dispatchEvent(new Event('resize')))
  expect(result.current).toEqual([])
  unmount()
  expect(disconnect).toHaveBeenCalled()
  expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
  expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), true)
  vi.unstubAllGlobals()
})
