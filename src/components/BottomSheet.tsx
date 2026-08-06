import { useEffect, useRef, type ReactNode } from "react";

interface BottomSheetProps {
  title: string;
  children: ReactNode;
  onClose(): void;
}

export function BottomSheet({ title, children, onClose }: BottomSheetProps) {
  const titleId = `sheet-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.classList.add("sheet-open");
    const first = sheet.current?.querySelector<HTMLElement>(
      "button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    first?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !sheet.current) return;
      const items = [
        ...sheet.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
        ),
      ];
      if (!items.length) return;
      const firstItem = items[0];
      const lastItem = items.at(-1)!;
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("sheet-open");
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={sheet}
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="sheet-grabber" />
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
