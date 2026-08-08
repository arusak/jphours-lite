import { useId, type ReactNode } from "react";

interface TimerRingProps {
  progress?: number | null;
  tone?: "exercise" | "break" | "quick-rest";
  value: ReactNode;
  label: string;
  accessibleValue?: string;
}

const RADIUS = 128;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function TimerRing({
  progress = null,
  tone = "exercise",
  value,
  label,
  accessibleValue = String(value),
}: TimerRingProps) {
  const gradientId = useId();
  const fraction = Math.min(1, Math.max(0, progress ?? 0));
  return (
    <div
      className={`timer-ring timer-ring--${tone}`}
      aria-label={`${label}: ${accessibleValue}`}
      data-testid="timer-ring"
      data-open-ended={progress === null}
    >
      <div className="timer-ring__glow" />
      <svg viewBox="0 0 268 268" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            {tone === "break" ? (
              <>
                <stop stopColor="oklch(0.72 0.16 55)" />
                <stop offset="1" stopColor="oklch(0.58 0.19 32)" />
              </>
            ) : tone === "quick-rest" ? (
              <>
                <stop stopColor="oklch(0.72 0.13 165)" />
                <stop offset="1" stopColor="oklch(0.56 0.14 205)" />
              </>
            ) : (
              <>
                <stop stopColor="oklch(0.86 0.15 82)" />
                <stop offset="1" stopColor="oklch(0.66 0.17 45)" />
              </>
            )}
          </linearGradient>
        </defs>
        <circle
          className="timer-ring__track"
          cx="134"
          cy="134"
          r={RADIUS}
          fill="none"
          strokeWidth="12"
        />
        {progress !== null && (
          <circle
            className="timer-ring__progress"
            cx="134"
            cy="134"
            r={RADIUS}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="12"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          />
        )}
      </svg>
      <div className="timer-ring__content">
        <span className="timer-ring__value">{value}</span>
        <span className="timer-ring__label">{label}</span>
      </div>
    </div>
  );
}
