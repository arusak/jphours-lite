interface ProgressSegmentsProps {
  count: number;
  current: number;
  tone?: "exercise" | "break" | "quick-rest";
  label?: string;
}

export function ProgressSegments({
  count,
  current,
  tone = "exercise",
  label = "Session progress",
}: ProgressSegmentsProps) {
  return (
    <div
      className={`progress-segments${count > 12 ? " progress-segments--dense" : ""}${tone === "break" ? " progress-segments--break" : ""}${tone === "quick-rest" ? " progress-segments--quick-rest" : ""}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={count}
      aria-valuenow={Math.min(Math.max(current + 1, 0), count)}
    >
      {Array.from({ length: Math.max(0, count) }, (_, index) => (
        <span
          className="progress-segment"
          data-state={index < current ? "complete" : index === current ? "current" : "future"}
          key={index}
        />
      ))}
    </div>
  );
}
