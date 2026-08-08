import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const iconProps = {
  "aria-hidden": true,
  viewBox: "0 0 24 24",
};

export function RewindIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m19 20-10-8 10-8v16Z" />
      <path d="M5 19V5" />
    </svg>
  );
}

export function ForwardIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m5 4 10 8-10 8V4Z" />
      <path d="M19 5v14" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props} fill="currentColor">
      <path d="M7 4.5v15l12-7.5-12-7.5Z" />
    </svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props} fill="currentColor">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props} fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}
