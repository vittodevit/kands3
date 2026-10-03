import { AnimatePresence, motion } from "motion/react";
import { useSession } from "@/state/sessionStore";
import { useT } from "@/i18n/useT";
import type { StepKind } from "@/core/types";
import { cn } from "@/lib/utils";

/** Badge accent per step kind (theme tokens, both themes). */
const KIND_CLASS: Record<StepKind, string> = {
  busTransfer: "bg-accent-bus-soft text-accent-bus",
  aluOp: "bg-accent-bus-soft text-accent-bus",
  regWrite: "bg-accent-reg-soft text-accent-reg",
  memWrite: "bg-accent-memory-soft text-accent-memory",
  memRead: "bg-accent-memory-soft text-accent-memory",
  fetch: "bg-accent-control-soft text-accent-control",
  decode: "bg-accent-control-soft text-accent-control",
  pcUpdate: "bg-accent-control-soft text-accent-control",
  branch: "bg-accent-control-soft text-accent-control",
  halt: "bg-accent-danger-soft text-accent-danger",
  contention: "bg-accent-danger-soft text-accent-danger",
  actor: "bg-accent-reg-soft text-accent-reg",
};

/**
 * Narration panel: plain-English explanation of the active timeline step,
 * with a step-kind badge and animated presence transitions. Doubles as an
 * aria-live region for screen readers.
 */
export function NarrationPanel() {
  const t = useT();
  const activeStep = useSession((s) => s.activeStep);
  const cursor = useSession((s) => s.cursor);
  const total = useSession((s) => s.timeline.length);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      data-testid="narration-live"
      className="relative min-h-16"
    >
      <AnimatePresence mode="wait" initial={false}>
        {activeStep ? (
          <motion.div
            key={cursor}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            data-testid="narration-step"
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "machine-nums rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                  KIND_CLASS[activeStep.kind],
                )}
              >
                {t(`stepkind.${activeStep.kind}`)}
              </span>
              <span className="machine-nums text-[11px] text-ink-faint">
                {t("panel.narration.stepOf", { cursor, total })}
              </span>
              {activeStep.weight === 4 && (
                <span className="machine-nums rounded-full bg-accent-memory-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-memory">
                  {t("memory.slowWrite")}
                </span>
              )}
            </div>
            <p className="text-xs leading-relaxed text-ink">{activeStep.narration}</p>
          </motion.div>
        ) : (
          <motion.p
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            data-testid="narration-idle"
            className="text-xs leading-relaxed text-ink-faint"
          >
            {t("panel.narration.idle")}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
