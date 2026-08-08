import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { practiceConfig } from "../../../config/practice-config";
import styles from "./StopSlider.module.css";

interface StopSliderProps {
  onStop(): void;
}
export function StopSlider({ onStop }: StopSliderProps) {
  const [value, setValue] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fired = useRef(false);
  const threshold = practiceConfig.interaction.slideToStopThreshold * 100;
  const commit = (next: number) => {
    setValue(next);
    if (next >= threshold && !fired.current) {
      fired.current = true;
      onStop();
    }
  };
  const pointerValue = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return Math.round(
      Math.min(
        100,
        Math.max(0, ((event.clientX - bounds.left - 4) / Math.max(1, bounds.width - 56)) * 100),
      ),
    );
  };
  return (
    <div
      className={styles.stopSlider}
      style={{ "--slider-value": value / 100 } as CSSProperties}
      role="slider"
      tabIndex={0}
      aria-label="Slide to stop"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      data-dragging={dragging}
      onPointerDown={(event) => {
        fired.current = false;
        setDragging(true);
        event.currentTarget.setPointerCapture?.(event.pointerId);
        commit(pointerValue(event));
      }}
      onPointerMove={(event) => {
        if (dragging) setValue(pointerValue(event));
      }}
      onPointerUp={(event) => {
        if (!dragging) return;
        const next = pointerValue(event);
        setDragging(false);
        commit(next);
        if (next < threshold) setValue(0);
      }}
      onPointerCancel={() => {
        setDragging(false);
        fired.current = false;
        setValue(0);
      }}
      onKeyDown={(event) => {
        if (event.key === "End") commit(100);
        else if (event.key === "Home") {
          fired.current = false;
          setValue(0);
        } else if (event.key === "ArrowRight" || event.key === "ArrowUp")
          commit(Math.min(100, value + 10));
        else if (event.key === "ArrowLeft" || event.key === "ArrowDown")
          setValue(Math.max(0, value - 10));
      }}
      onBlur={() => {
        if (value < threshold) {
          fired.current = false;
          setValue(0);
        }
      }}
    >
      <span>■</span>
      <strong>Slide to stop</strong>
    </div>
  );
}
