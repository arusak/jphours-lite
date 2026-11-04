import { expect, it } from 'vitest'
import { routineHintConfig } from './routine-hint-config'
import { layoutRoutineHints, type RoutineHintMeasurements } from './routine-hint-layout'

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
})
const measurements: RoutineHintMeasurements = {
  labels: {
    settings: { width: 200, height: 24 },
    edit: { width: 200, height: 24 },
    add: { width: 200, height: 24 },
  },
  container: rect(0, 0, 320, 568),
  viewport: { width: 320, height: 568 },
  card: rect(16, 220, 288, 80),
  targets: {
    settings: { rect: rect(16, 150, 288, 40), hidden: false },
    edit: { rect: rect(250, 250, 40, 40), iconRect: rect(260, 260, 20, 20), hidden: false },
    add: { rect: rect(16, 400, 140, 44), hidden: false },
  },
}

it('applies per-hint label and arrow configuration without changing other hints', () => {
  const config = structuredClone(routineHintConfig)
  Object.assign(config.hints.settings.label, {
    text: 'Custom settings',
    gap: 10,
  })
  Object.assign(config.hints.settings.arrow, { headLength: 12, direction: -1 })
  config.hints.settings.target.gap = 8
  const anchors = layoutRoutineHints(
    { ...measurements, labels: { ...measurements.labels, settings: { width: 140, height: 32 } } },
    config,
  )
  const settings = anchors.find(({ key }) => key === 'settings')!
  expect(settings).toMatchObject({ text: 'Custom settings', width: 140, height: 32, top: 200 })
  const [sx, sy, cx, , , , x, y, hx, hy] = settings.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
  expect(sx).toBe(settings.left + 70)
  expect(sy).toBe(settings.top)
  expect(cx).toBeLessThan(sx!)
  expect([x, y]).toEqual([160, 198])
  expect(Math.hypot(hx! - x!, hy! - y!)).toBeCloseTo(12)
  expect(anchors.slice(1)).toEqual(layoutRoutineHints(measurements).slice(1))
})

it('uses measured label height for the arrow attachment below an above-target label', () => {
  const config = structuredClone(routineHintConfig)
  const labels = { ...measurements.labels, add: { width: 110, height: 30 } }
  const add = layoutRoutineHints({ ...measurements, labels }, config).find(
    ({ key }) => key === 'add',
  )!
  const points = add.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
  expect(points[1]).toBe(add.top + 30)
})

it('omits only hidden, offscreen, or missing targets', () => {
  expect(
    layoutRoutineHints({
      ...measurements,
      targets: {
        ...measurements.targets,
        edit: { ...measurements.targets.edit!, hidden: true },
      },
    }).map(({ key }) => key),
  ).toEqual(['settings', 'add'])
  expect(
    layoutRoutineHints({
      ...measurements,
      targets: {
        settings: { rect: rect(16, -10, 288, 40), hidden: false },
        add: measurements.targets.add,
      },
    }).map(({ key }) => key),
  ).toEqual(['add'])
})

it('returns no hints without usable container space', () => {
  expect(layoutRoutineHints({ ...measurements, container: undefined })).toEqual([])
  expect(layoutRoutineHints({ ...measurements, container: rect(0, 0, 20, 568) })).toEqual([])
})

it('places differently sized labels within bounds and attaches arrows at their actual centers', () => {
  const labels = {
    settings: { width: 155, height: 25 },
    edit: { width: 112, height: 25 },
    add: { width: 98, height: 25 },
  }
  for (const card of [measurements.card, rect(16, 300, 288, 80)]) {
    for (const anchor of layoutRoutineHints({ ...measurements, card, labels })) {
      expect(anchor.width).toBe(labels[anchor.key].width)
      expect(anchor.left).toBeGreaterThanOrEqual(16)
      expect(anchor.left + anchor.width).toBeLessThanOrEqual(304)
      const points = anchor.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
      expect(points[0]).toBe(anchor.left + labels[anchor.key].width / 2)
    }
  }
})

it('omits unmeasured labels and labels that cannot fit without clipping', () => {
  const labels = { settings: { width: 400, height: 25 }, add: { width: 98, height: 25 } }
  expect(layoutRoutineHints({ ...measurements, labels }).map(({ key }) => key)).toEqual(['add'])
})
