import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, History, RotateCcw, Trash2 } from "lucide-react";
import { useSession } from "@/state/sessionStore";
import { useT } from "@/i18n/useT";
import type { StepKind } from "@/core/types";
import { Button, IconButton } from "@/ui/primitives";
import { cn } from "@/lib/utils";

/** Dot color per step kind (theme tokens). */
const KIND_DOT: Record<StepKind, string> = {
  busTransfer: "bg-accent-bus",
  aluOp: "bg-accent-bus",
  regWrite: "bg-accent-reg",
  memWrite: "bg-accent-memory",
  memRead: "bg-accent-memory",
  fetch: "bg-accent-control",
  decode: "bg-accent-control",
  pcUpdate: "bg-accent-control",
  branch: "bg-accent-control",
  halt: "bg-accent-danger",
  contention: "bg-accent-danger",
  actor: "bg-accent-reg",
};

/**
 * Time-travel filmstrip: one color-coded tick per timeline step. Click or
 * drag to scrub, step back/forward, restore the shown state as the new
 * base, or discard the run entirely.
 */
export function HistoryPanel() {
  const t = useT();
  const timeline = useSession((s) => s.timeline);
  const cursor = useSession((s) => s.cursor);
  const scrubTo = useSession((s) => s.scrubTo);
  const stepBack = useSession((s) => s.stepBack);
  const stepForward = useSession((s) => s.stepForward);
  const commitShownToBase = useSession((s) => s.commitShownToBase);
  const clearRun = useSession((s) => s.clearRun);

  const [dragging, setDragging] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  if (timeline.length === 0) {
    return (
      <div className="flex min-h-16 items-center gap-2 text-xs text-ink-faint" data-testid="history-empty">
        <History aria-hidden className="h-4 w-4 shrink-0" />
        {t("panel.history.empty")}
      </div>
    );
  }

  const scrubFromEvent = (e: React.PointerEvent) => {
    const strip = stripRef.current;
    if (!strip) return;
    const ticks = strip.querySelectorAll<HTMLButtonElement>("[data-tick-index]");
    for (const tick of ticks) {
      const r = tick.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right) {
        const i = Number(tick.dataset.tickIndex);
        if (!Number.isNaN(i) && i !== cursor) scrubTo(i);
        return;
      }
    }
  };

  return (
    <div className="flex flex-col gap-2" data-testid="history-strip">
      {/* Filmstrip */}
      <div
        ref={stripRef}
        role="slider"
        aria-label={t("panel.history.scrubber")}
        aria-valuemin={0}
        aria-valuemax={timeline.length}
        aria-valuenow={cursor}
        aria-valuetext={t("panel.history.position", { cursor, total: timeline.length })}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            stepBack();
            e.preventDefault();
          } else if (e.key === "ArrowRight") {
            stepForward();
            e.preventDefault();
          }
        }}
        className="flex touch-none items-stretch gap-[3px] overflow-x-auto rounded-lg border border-line bg-surface-sunken p-1.5"
        onPointerDown={(e) => {
          setDragging(true);
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          scrubFromEvent(e);
        }}
        onPointerMove={(e) => {
          if (dragging) scrubFromEvent(e);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        {/* Initial-state tick (cursor 0). */}
        <button
          type="button"
          data-tick-index={0}
          aria-label={t("panel.history.start")}
          aria-current={cursor === 0}
          onClick={() => scrubTo(0)}
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[10px] font-semibold",
            cursor === 0
              ? "border-accent-bus bg-accent-bus-soft text-accent-bus"
              : "border-line bg-surface text-ink-faint hover:text-ink",
          )}
          title={t("panel.history.start")}
        >
          ∅
        </button>
        {timeline.map((step, i) => {
          const active = cursor === i + 1;
          // Instruction boundary: a divider before every fetch (except the
          // first) groups the strip per instruction in full-machine runs.
          const startsInstruction = step.kind === "fetch" && i > 0;
          return (
            <div key={i} className="flex shrink-0 items-stretch gap-[3px]">
              {startsInstruction && (
                <span
                  aria-hidden
                  className="my-0.5 w-px shrink-0 self-stretch bg-line-strong"
                  data-instruction-divider
                />
              )}
              <button
                type="button"
                data-tick-index={i + 1}
                aria-label={`${t(`stepkind.${step.kind}`)} — ${step.narration}`}
                aria-current={active}
                onClick={() => scrubTo(i + 1)}
                title={`${t(`stepkind.${step.kind}`)}: ${step.narration}`}
                className={cn(
                  "flex h-7 w-7 shrink-0 flex-col items-center justify-center gap-1 rounded-md border",
                  active
                    ? "border-accent-bus bg-accent-bus-soft"
                    : "border-line bg-surface hover:border-line-strong",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", KIND_DOT[step.kind])} />
                <span
                  className={cn(
                    "machine-nums text-[9px] leading-none",
                    active ? "text-accent-bus" : "text-ink-faint",
                  )}
                >
                  {i + 1}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <IconButton
            aria-label={t("panel.history.back")}
            disabled={cursor <= 0}
            onClick={stepBack}
            className="h-7 w-7"
          >
            <ChevronLeft aria-hidden className="h-4 w-4" />
          </IconButton>
          <span className="machine-nums text-[11px] text-ink-faint">
            {t("panel.history.position", { cursor, total: timeline.length })}
          </span>
          <IconButton
            aria-label={t("panel.history.forward")}
            disabled={cursor >= timeline.length}
            onClick={stepForward}
            className="h-7 w-7"
          >
            <ChevronRight aria-hidden className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="secondary" onClick={commitShownToBase}>
            <RotateCcw aria-hidden className="h-3.5 w-3.5" />
            {t("panel.history.restore")}
          </Button>
          <Button size="sm" variant="ghost" onClick={clearRun}>
            <Trash2 aria-hidden className="h-3.5 w-3.5" />
            {t("panel.history.discard")}
          </Button>
        </div>
      </div>
    </div>
  );
}
