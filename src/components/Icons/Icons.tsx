import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const iconProps = {
  'aria-hidden': true,
  viewBox: '0 0 24 24',
}

export function RewindIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m19 20-10-8 10-8v16Z" />
      <path d="M5 19V5" />
    </svg>
  )
}

export function ForwardIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m5 4 10 8-10 8V4Z" />
      <path d="M19 5v14" />
    </svg>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props} fill="currentColor">
      <path d="M7 4.5v15l12-7.5-12-7.5Z" />
    </svg>
  )
}

export function PauseIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props} fill="currentColor">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  )
}

export function StopIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props} fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  )
}

export function NoteIcon(props: IconProps) {
  return (
    <svg
      {...iconProps}
      {...props}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M9 18V5l10-2v13" />
      <ellipse cx="6.5" cy="18" rx="2.5" ry="2" fill="currentColor" stroke="none" />
      <ellipse cx="16.5" cy="16" rx="2.5" ry="2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg
      {...iconProps}
      {...props}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export function DragHandleIcon(props: IconProps) {
  return (
    <svg
      {...iconProps}
      {...props}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.5"
    >
      <circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function BreakIcon(props: IconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3.5"
    >
      <path d="M13 25h30v16a12 12 0 0 1-12 12h-6a12 12 0 0 1-12-12V25Z" />
      <path d="M45 30h4a7 7 0 0 1 0 14h-4" />
      <path d="M10 55h40M23 19c-4-4 2-7-1-11M30 19c-4-4 2-7-1-11M37 19c-4-4 2-7-1-11" />
    </svg>
  )
}

export function ExerciseIcon(props: IconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3.5"
    >
      <circle cx="32" cy="14" r="6" />
      <path d="M32 20v19M32 25 18 34M32 25l14 9M32 39 21 54M32 39l11 15" />
    </svg>
  )
}
