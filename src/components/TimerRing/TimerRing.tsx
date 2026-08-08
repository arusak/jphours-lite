import { useId, type ReactNode } from "react";
import styles from "./TimerRing.module.css";

interface TimerRingProps {
  children: ReactNode;
  progress?: number | null;
  tone?: "exercise" | "break" | "quick-rest";
  accessibleName?: string;
}

const RADIUS = 128;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function TimerRing({
  children,
  progress = null,
  tone = "exercise",
  accessibleName,
}: TimerRingProps) {
  const gradientId = useId();
  const fraction = Math.min(1, Math.max(0, progress ?? 0));
  return (
    <div
      className={`${styles.timerRing} ${tone === "break" ? styles.break : tone === "quick-rest" ? styles.quickRest : ""}`}
      aria-label={accessibleName}
      data-testid="timer-ring"
      data-open-ended={progress === null}
      data-tone={tone}
    >
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
          className={styles.track}
          cx="134"
          cy="134"
          r={RADIUS}
          fill="none"
          strokeWidth="12"
        />
        {progress !== null && (
          <circle
            className={styles.progress}
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
      <div className={styles.content}>{children}</div>
    </div>
  );
}
