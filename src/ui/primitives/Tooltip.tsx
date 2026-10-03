import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  /** Tooltip body class override (rarely needed). */
  contentClassName?: string;
  side?: "top" | "bottom";
};

type Pos = { left: number; top: number; visible: boolean };

/**
 * Portaled tooltip: floats above (or below) the trigger using fixed
 * positioning in a portal on <body>, so it is never clipped or overlapped
 * by scroll containers (memory rows, stage cards) — a z-index alone cannot
 * escape overflow clipping. Appears on hover AND keyboard focus.
 */
export function Tooltip({ content, children, className, contentClassName, side = "top" }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<Pos>({ left: 0, top: 0, visible: false });

  // Position after open (and on any scroll/resize while open) from live
  // trigger + tooltip rects; clamped to the viewport.
  useLayoutEffect(() => {
    if (!open) return;
    let raf = 0;
    const place = () => {
      const trigger = triggerRef.current;
      const tip = tipRef.current;
      if (!trigger || !tip) return;
      const r = trigger.getBoundingClientRect();
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      const margin = 8;
      let left = r.left + r.width / 2 - tw / 2;
      left = Math.min(Math.max(left, margin), window.innerWidth - tw - margin);
      const top =
        side === "top"
          ? Math.max(r.top - th - 6, margin)
          : Math.min(r.bottom + 6, window.innerHeight - th - margin);
      setPos({ left, top, visible: true });
    };
    raf = requestAnimationFrame(place);
    // Capture phase: catch scrolls from ANY ancestor scroll container.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, side, content]);

  return (
    <span
      ref={triggerRef}
      className={cn("inline-flex", className)}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      {children}
      {open &&
        createPortal(
          <span
            ref={tipRef}
            role="tooltip"
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              visibility: pos.visible ? "visible" : "hidden",
            }}
            className={cn(
              "pointer-events-none z-[9999] w-max max-w-64",
              "rounded-lg border border-line bg-surface-raised px-2.5 py-1.5 text-left",
              "text-xs leading-relaxed text-ink-muted shadow-raised",
            )}
          >
            <span className={cn("block", contentClassName)}>{content}</span>
          </span>,
          document.body,
        )}
    </span>
  );
}
