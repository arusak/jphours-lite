export const hintKeys = ['settings', 'edit', 'add'] as const
export type RoutineHintKey = (typeof hintKeys)[number]

interface HintDefinition {
  label: {
    text: string
    placement: 'above' | 'below-target' | 'below-card'
    align: 'left' | 'right'
    gap: number
    compactGap: number
    rightInset: number
    roomyOffsetX: number
    roomyOffsetY: number
    tightRow: number
  }
  target: { edge: 'top' | 'bottom'; gap: number; useIcon: boolean }
  arrow: {
    direction: number
    maxHorizontalReach: number
    maxVerticalReach: number
    maxBow: number
    bowRatio: number
    endBowRatio: number
    controlStart: number
    controlEnd: number
    headLength: number
    headAngle: number
  }
}

export interface RoutineHintConfig {
  viewportPadding: number
  containerPadding: number
  spacing: {
    compact: number
    tight: number
    roomy: number
    minUpperGap: number
    tightTop: number
    tightRow: number
  }
  hints: Record<RoutineHintKey, HintDefinition>
}

const labelDefaults = { compactGap: 0, rightInset: 24 }
const arrowDefaults = {
  maxHorizontalReach: 100,
  maxVerticalReach: 160,
  maxBow: 48,
  bowRatio: 0.35,
  endBowRatio: 0.65,
  controlStart: 0.18,
  controlEnd: 0.68,
  headLength: 7.5,
  headAngle: 0.55,
}

// All dimensions are pixels; arrow angles are radians. Per-hint values override shared defaults.
export const routineHintConfig: RoutineHintConfig = {
  viewportPadding: 8,
  containerPadding: 16,
  spacing: { compact: 160, tight: 96, roomy: 240, minUpperGap: 88, tightTop: 4, tightRow: 28 },
  hints: {
    settings: {
      label: {
        ...labelDefaults,
        text: 'Adjust routine settings',
        placement: 'below-target',
        align: 'right',
        gap: 4,
        roomyOffsetX: -24,
        roomyOffsetY: -60,
        tightRow: 0,
      },
      target: { edge: 'bottom', gap: 3, useIcon: false },
      arrow: { ...arrowDefaults, direction: 1 },
    },
    edit: {
      label: {
        ...labelDefaults,
        text: 'Edit this exercise',
        placement: 'below-card',
        align: 'right',
        gap: 12,
        roomyOffsetX: 24,
        roomyOffsetY: -12,
        tightRow: 1,
      },
      target: { edge: 'bottom', gap: 3, useIcon: true },
      arrow: { ...arrowDefaults, direction: 1 },
    },
    add: {
      label: {
        ...labelDefaults,
        text: 'Add an exercise',
        placement: 'above',
        align: 'left',
        gap: 48,
        compactGap: 32,
        roomyOffsetX: 0,
        roomyOffsetY: 60,
        tightRow: 2,
      },
      target: { edge: 'top', gap: 3, useIcon: false },
      arrow: { ...arrowDefaults, direction: -1 },
    },
  },
}
