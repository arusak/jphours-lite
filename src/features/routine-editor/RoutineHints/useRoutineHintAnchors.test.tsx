import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useRoutineHintAnchors } from './useRoutineHintAnchors'

afterEach(() => vi.restoreAllMocks())

function measuredLabels() {
  return {
    current: Object.fromEntries(
      ['settings', 'edit', 'add'].map((key) => {
        const label = document.createElement('span')
        vi.spyOn(label, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 200, 24))
        return [key, label]
      }),
    ),
  }
}

it('keeps compact annotations, refreshes on resize/scroll, omits invisible targets and cleans up', async () => {
  vi.stubGlobal('innerHeight', 568)
  vi.stubGlobal('innerWidth', 320)
  const editor = document.createElement('section')
  const card = document.createElement('article')
  const edit = document.createElement('button')
  const icon = document.createElement('span')
  edit.append(icon)
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
  vi.spyOn(icon, 'getBoundingClientRect').mockImplementation(() => rect(260, editTop + 10, 20, 20))
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
  const labelRefs = measuredLabels()
  const targets = {
    containerRef: { current: editor },
    addExerciseRef: { current: add },
    settingsRef: { current: settings },
    editExerciseRef: { current: edit },
  }
  const { result, unmount } = renderHook(() => useRoutineHintAnchors(targets, labelRefs))
  expect(result.current.map(({ key }) => key)).toEqual(['settings', 'edit', 'add'])
  expect(result.current.map(({ top }) => top)).toEqual([194, 312, 368])
  // Curves may bow sideways, but must progress toward the target without curling back.
  for (const { path } of result.current) {
    const [sx, sy, cx1, cy1, cx2, cy2, ex, ey] = path.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    for (const x of [cx1!, cx2!]) expect(x).toBeGreaterThanOrEqual(Math.min(sx!, ex!) - 48)
    for (const x of [cx1!, cx2!]) expect(x).toBeLessThanOrEqual(Math.max(sx!, ex!) + 48)
    for (const y of [cy1!, cy2!]) expect(y).toBeGreaterThanOrEqual(Math.min(sy!, ey!))
    for (const y of [cy1!, cy2!]) expect(y).toBeLessThanOrEqual(Math.max(sy!, ey!))
  }
  for (const { path } of result.current) {
    const points = path.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    expect(Math.hypot(points[8]! - points[6]!, points[9]! - points[7]!)).toBeCloseTo(7.5)
    expect(Math.hypot(points[12]! - points[6]!, points[13]! - points[7]!)).toBeCloseTo(7.5)
  }
  const addAnchor = result.current.find(({ key }) => key === 'add')!
  expect(Number(addAnchor.path.split(' ')[1])).toBe(addAnchor.left + addAnchor.width / 2)
  const addPoints = addAnchor.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
  expect(addPoints[2]).toBeLessThan(addPoints[0]!)
  expect(addPoints[4]).toBeLessThan(addPoints[6]!)
  const editAnchor = result.current.find(({ key }) => key === 'edit')!
  const editEndpoint = editAnchor.path
    .match(/-?\d+(?:\.\d+)?/g)!
    .map(Number)
    .slice(6, 8)
  expect(editEndpoint).toEqual([270, 283])
  for (const attribute of ['aria-hidden', 'inert']) {
    await act(async () => edit.setAttribute(attribute, 'true'))
    expect(result.current.map(({ key }) => key)).toEqual(['settings', 'add'])
    await act(async () => edit.removeAttribute(attribute))
    expect(result.current.map(({ key }) => key)).toEqual(['settings', 'edit', 'add'])
  }
  const addLabel = labelRefs.current.add!
  vi.mocked(addLabel.getBoundingClientRect).mockReturnValue(new DOMRect(0, 0, 110, 25))
  act(() => resize([], {} as ResizeObserver))
  const resizedAdd = result.current.find(({ key }) => key === 'add')!
  expect(resizedAdd.width).toBe(110)
  const resizedPoints = resizedAdd.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
  expect(resizedPoints.slice(0, 2)).toEqual([resizedAdd.left + 55, resizedAdd.top + 25])
  vi.mocked(addLabel.getBoundingClientRect).mockReturnValue(new DOMRect(0, 0, 200, 24))
  act(() => resize([], {} as ResizeObserver))
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
  // On tall screens, use the open space rather than hugging the controls.
  vi.stubGlobal('innerHeight', 1200)
  cardTop = 220
  editTop = 250
  addTop = 1000
  act(() => window.dispatchEvent(new Event('resize')))
  const centered = result.current
  expect(centered.map(({ top }) => top)).toEqual([353, 443, 813])
  for (const label of centered) {
    expect(label.left + label.width / 2).toBeGreaterThanOrEqual(136)
    expect(label.left + label.width / 2).toBeLessThanOrEqual(184)
  }
  // The control polygon bounds the curve length, including its curvature.
  for (const height of [1200, 2400, 4800]) {
    vi.stubGlobal('innerHeight', height)
    addTop = height - 100
    act(() => window.dispatchEvent(new Event('resize')))
    for (const anchor of result.current) {
      const points = anchor.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
      let upperLength = 0
      for (let index = 0; index < 6; index += 2) {
        upperLength += Math.hypot(
          points[index + 2]! - points[index]!,
          points[index + 3]! - points[index + 1]!,
        )
      }
      expect(upperLength).toBeLessThanOrEqual(240)
      expect(points[0]).toBe(anchor.left + anchor.width / 2)
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

it('hides hints while settings are unfolded and restores aligned arrows after folding', async () => {
  const editor = document.createElement('section')
  const surface = document.createElement('div')
  const face = document.createElement('div')
  const header = document.createElement('header')
  const settings = document.createElement('button')
  header.append(settings)
  face.append(header)
  surface.append(face)
  const card = document.createElement('article')
  const edit = document.createElement('button')
  card.append(edit)
  const add = document.createElement('button')
  editor.append(surface, card, add)
  let editTop = 250
  const rect = (top: number, height: number) => new DOMRect(16, top, 288, height)
  vi.spyOn(editor, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 320, 1000))
  vi.spyOn(settings, 'getBoundingClientRect').mockReturnValue(rect(150, 40))
  vi.spyOn(card, 'getBoundingClientRect').mockImplementation(() => rect(editTop - 30, 80))
  vi.spyOn(edit, 'getBoundingClientRect').mockImplementation(() => rect(editTop, 40))
  vi.spyOn(add, 'getBoundingClientRect').mockReturnValue(rect(800, 44))
  vi.stubGlobal('innerWidth', 320)
  vi.stubGlobal('innerHeight', 1000)
  const observed = new Set<Element>()
  let notify!: ResizeObserverCallback
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        notify = callback
      }
      observe(element: Element) {
        observed.add(element)
      }
      disconnect() {
        observed.clear()
      }
    },
  )
  try {
    const labelRefs = measuredLabels()
    const targets = {
      containerRef: { current: editor },
      settingsRef: { current: settings },
      editExerciseRef: { current: edit },
      addExerciseRef: { current: add },
    }
    const { result, unmount } = renderHook(() => useRoutineHintAnchors(targets, labelRefs))
    const endpoint = () =>
      result.current
        .find(({ key }) => key === 'edit')!
        .path.match(/-?\d+(?:\.\d+)?/g)!
        .map(Number)
        .slice(6, 8)
    expect(endpoint()).toEqual([160, 293])
    expect(observed.has(surface)).toBe(true)
    const initial = result.current
    await act(async () => settings.setAttribute('aria-expanded', 'true'))
    expect(result.current).toEqual([])
    // The settings surface changes size; the editor, edit button and card keep their sizes.
    for (const top of [350, 450, 350, 250]) {
      editTop = top
      act(() => {
        if (observed.has(surface))
          notify(
            [
              {
                target: surface,
                contentRect: surface.getBoundingClientRect(),
                borderBoxSize: [],
                contentBoxSize: [],
                devicePixelContentBoxSize: [],
              },
            ],
            {} as ResizeObserver,
          )
      })
      expect(result.current).toEqual([])
    }
    await act(async () => settings.setAttribute('aria-expanded', 'false'))
    expect(result.current).toEqual(initial)
    editTop = 350
    act(() => notify([], {} as ResizeObserver))
    expect(endpoint()).toEqual([160, 393])
    unmount()
    expect(observed.size).toBe(0)
  } finally {
    vi.unstubAllGlobals()
  }
})
