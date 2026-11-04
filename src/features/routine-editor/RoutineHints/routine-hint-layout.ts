import {
  routineHintConfig,
  hintKeys,
  type RoutineHintKey,
  type RoutineHintConfig,
} from './routine-hint-config'

export interface HintRect {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

export interface RoutineHintMeasurements {
  labels: Partial<Record<RoutineHintKey, { width: number; height: number }>>
  container?: HintRect
  card?: HintRect
  viewport: { width: number; height: number }
  targets: Partial<Record<RoutineHintKey, { rect: HintRect; iconRect?: HintRect; hidden: boolean }>>
}

export interface RoutineHintAnchor {
  key: RoutineHintKey
  text: string
  height: number
  left: number
  top: number
  width: number
  path: string
}

export function layoutRoutineHints(
  { container, card, viewport, targets, labels }: RoutineHintMeasurements,
  config: RoutineHintConfig = routineHintConfig,
): RoutineHintAnchor[] {
  if (!container?.width) return []
  const left = Math.max(config.viewportPadding, container.left + config.containerPadding)
  const right = Math.min(
    viewport.width - config.viewportPadding,
    container.right - config.containerPadding,
  )
  if (right <= left) return []
  const cardBottom = card?.bottom
  const addTop = targets.add?.rect.top ?? viewport.height
  const compact = !!cardBottom && addTop - cardBottom < config.spacing.compact
  const tight = !!cardBottom && addTop - cardBottom < config.spacing.tight
  const cardTop = card?.top ?? 0
  const settingsBottom = targets.settings?.rect.bottom ?? cardTop
  // Extremely dense layouts have no room for passive copy without obscuring content.
  if (tight && cardTop - settingsBottom < config.spacing.minUpperGap) return []
  const roomy = !!cardBottom && addTop - cardBottom >= config.spacing.roomy
  const next: RoutineHintAnchor[] = []
  for (const key of hintKeys) {
    const hint = config.hints[key]
    const label = labels[key]
    if (!label?.width || !label.height || label.width > right - left) continue
    const { width, height } = label
    const target = targets[key]
    if (!target || target.hidden) continue
    const { rect, iconRect } = target
    if (
      !rect.width ||
      !rect.height ||
      rect.top < 0 ||
      rect.bottom > viewport.height ||
      rect.left < 0 ||
      rect.right > viewport.width
    )
      continue
    const openCenter = ((cardBottom ?? rect.bottom) + addTop) / 2
    let top: number
    if (roomy) {
      top = openCenter + hint.label.roomyOffsetY
    } else if (tight) {
      top = settingsBottom + config.spacing.tightTop + hint.label.tightRow * config.spacing.tightRow
    } else {
      switch (hint.label.placement) {
        case 'above':
          top = rect.top - (compact ? hint.label.compactGap : hint.label.gap)
          break
        case 'below-target':
          top = rect.bottom + hint.label.gap
          break
        case 'below-card':
          top = (cardBottom ?? rect.bottom) + hint.label.gap
          break
      }
    }
    if (top < config.viewportPadding || top + height > viewport.height) continue
    let labelLeft = roomy
      ? Math.max(
          left,
          Math.min(right - width, (left + right - width) / 2 + hint.label.roomyOffsetX),
        )
      : hint.label.align === 'left' || tight
        ? left
        : Math.max(left, right - width - hint.label.rightInset)
    const targetRect = hint.target.useIcon && iconRect?.width ? iconRect : rect
    const x = targetRect.left + targetRect.width / 2
    const y =
      hint.target.edge === 'top'
        ? targetRect.top - hint.target.gap
        : targetRect.bottom + hint.target.gap
    // Bound the reach even when the empty space grows with viewport height.
    if (roomy)
      labelLeft = Math.max(
        left,
        Math.min(
          right - width,
          Math.max(
            x - hint.arrow.maxHorizontalReach - width / 2,
            Math.min(x + hint.arrow.maxHorizontalReach - width / 2, labelLeft),
          ),
        ),
      )
    top =
      y < top
        ? Math.min(top, y + hint.arrow.maxVerticalReach)
        : Math.max(top, y - hint.arrow.maxVerticalReach - height)
    const path = drawArrow(
      labelLeft + width / 2,
      y < top ? top : top + height,
      x,
      y,
      left,
      right,
      hint.arrow,
    )
    next.push({ key, text: hint.label.text, left: labelLeft, top, width, height, path })
  }
  return next
}

function drawArrow(
  startX: number,
  startY: number,
  x: number,
  y: number,
  left: number,
  right: number,
  arrow: RoutineHintConfig['hints'][RoutineHintKey]['arrow'],
): string {
  const dy = y - startY
  const bow = Math.min(arrow.maxBow, Math.abs(dy) * arrow.bowRatio) * arrow.direction
  const controlX1 = Math.max(left, Math.min(right, startX + bow))
  const controlX2 = Math.max(left, Math.min(right, x + bow * arrow.endBowRatio))
  const controlY1 = startY + dy * arrow.controlStart
  const controlY2 = startY + dy * arrow.controlEnd
  // Progress steadily toward the target while bowing asymmetrically for a hand-drawn curve.
  const angle = Math.atan2(y - controlY2, x - controlX2)
  const head = (offset: number) =>
    `${x - arrow.headLength * Math.cos(angle + offset)} ${y - arrow.headLength * Math.sin(angle + offset)}`
  return `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${x} ${y} M ${head(-arrow.headAngle)} L ${x} ${y} L ${head(arrow.headAngle)}`
}
