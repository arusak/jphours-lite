import type { ReactNode } from "react";
import styles from "./SessionIllustration.module.css";

type SessionIllustrationKind = "break" | "quick-rest" | "exercise";

export function SessionIllustration({ kind }: { kind: SessionIllustrationKind }) {
  if (kind === "break") return <CoffeeIllustration />;
  if (kind === "quick-rest") return <StretchingIllustration />;
  return <ExerciseIllustration />;
}

function Illustration({ children, kind }: { children: ReactNode; kind: SessionIllustrationKind }) {
  return (
    <svg
      className={`${styles.sessionIllustration} ${kind === "break" ? styles.illustrationBreak : kind === "quick-rest" ? styles.illustrationQuickRest : ""}`}
      data-testid={`${kind}-silhouette`}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function CoffeeIllustration() {
  return (
    <Illustration kind="break">
      <path d="M15 25h30v16a12 12 0 0 1-12 12h-6a12 12 0 0 1-12-12V25Z" />
      <path d="M45 30h4a7 7 0 0 1 0 14h-4" />
      <path d="M13 55h40M23 19c-4-4 2-7-1-11M34 19c-4-4 2-7-1-11" />
    </Illustration>
  );
}

function StretchingIllustration() {
  return (
    <Illustration kind="quick-rest">
      <circle cx="39" cy="14" r="5" />
      <path d="m35 22-12 8-12-2M35 23l7 12 12 9M30 29 18 47M18 47l-8 8M18 47l14 7M42 35l-4 17" />
    </Illustration>
  );
}

function ExerciseIllustration() {
  return (
    <Illustration kind="exercise">
      <circle cx="32" cy="14" r="6" />
      <path d="M32 20v19M32 25 18 34M32 25l14 9M32 39 21 54M32 39l11 15" />
    </Illustration>
  );
}
