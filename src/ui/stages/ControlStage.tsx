import { useEffect, useState } from "react";
import { Octagon, Play, Redo2, RotateCcw } from "lucide-react";
import type { MicroInst } from "@/core/types";
import { shownState, useSession } from "@/state/sessionStore";
import { useSettings } from "@/state/settingsStore";
import { useT } from "@/i18n/useT";
import { BitSlotField } from "@/ui/fields/BitSlotField";
import { InstructionField } from "@/ui/fields/InstructionField";
import { Button } from "@/ui/primitives";
import { cn } from "@/lib/utils";

const MICRO_IR_FIELDS: readonly { key: keyof MicroInst; len: number }[] = [
  { key: "AAddr", len: 2 },
  { key: "BAddr", len: 2 },
  { key: "ALU", len: 2 },
  { key: "CAddr", len: 2 },
  { key: "MMAddr", len: 5 },
  { key: "SW", len: 4 },
];

/**
 * Control unit stage: PC (5-bit, editable when idle), IR (16-bit with live
 * disassembly), Micro-IR (6 read-only fields mirroring machine.microIR),
 * Step/Run/Halt controls (Run repeats instruction cycles until HALT), and
 * fetch-cycle arrows (PC → Memory → IR → µIR / PC incrementer) that
 * energize from the active step's actors.
 */
export function ControlStage() {
  const t = useT();
  const features = useSettings((s) => s.features);

  const machine = useSession((s) => s.machine);
  const timeline = useSession((s) => s.timeline);
  const cursor = useSession((s) => s.cursor);
  const activeStep = useSession((s) => s.activeStep);
  const status = useSession((s) => s.status);
  const setMachine = useSession((s) => s.setMachine);
  const run = useSession((s) => s.run);
  const continueRun = useSession((s) => s.continueRun);
  const halt = useSession((s) => s.halt);

  const [autoRun, setAutoRun] = useState(false);

  const shown = shownState({ machine, timeline, cursor });
  const actors = new Set(activeStep?.actors ?? []);
  const kind = activeStep?.kind ?? null;
  const canEdit = status === "idle" || status === "done" || status === "halted";

  /* Run = continuous instruction cycles until HALT: whenever the current
     cycle finished without halting, APPEND the next one to the timeline so
     the history panel keeps a comprehensive breakdown of the whole run. */
  useEffect(() => {
    if (!autoRun) return;
    if (status === "done") {
      const shownHalted = timeline[cursor - 1]?.state.halted ?? false;
      if (shownHalted || timeline.length === 0) setAutoRun(false);
      else continueRun("instruction");
    } else if (status === "halted" || status === "paused" || status === "idle") {
      setAutoRun(false);
    }
  }, [autoRun, status, timeline, cursor, run, continueRun]);

  if (!features.control) return null;

  const irValue = shown.ir ?? 0;
  const hasIR = shown.ir !== null;

  return (
    <section
      aria-label={t("control.title")}
      data-stage="control"
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface-raised p-3 shadow-raised"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          {t("control.title")}
        </h2>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            disabled={!canEdit}
            title={t("control.resetPcHint")}
            onClick={() => {
              setAutoRun(false);
              // Reset PC for a fresh program start: PC ← 0, re-enable the
              // machine (clears HALT + latched control state). Clears history.
              setMachine({ pc: 0, halted: false, ir: null, microIR: null });
            }}
            data-testid="control-reset-pc"
          >
            <RotateCcw aria-hidden className="h-3.5 w-3.5" />
            {t("control.resetPc")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!canEdit}
            title={t("control.stepHint")}
            onClick={() => {
              setAutoRun(false);
              continueRun("instruction");
            }}
            data-testid="control-step"
          >
            <Redo2 aria-hidden className="h-3.5 w-3.5" />
            {t("control.step")}
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!canEdit}
            title={t("control.runHint")}
            onClick={() => {
              setAutoRun(true);
              // Halted shown state → fresh restart; otherwise append so the
              // run history accumulates across instructions.
              if (shownState(useSession.getState()).halted) run("instruction");
              else continueRun("instruction");
            }}
            data-testid="control-run"
          >
            <Play aria-hidden className="h-3.5 w-3.5" />
            {t("control.run")}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={status === "idle" || status === "halted"}
            onClick={() => {
              setAutoRun(false);
              halt();
            }}
            data-testid="control-halt"
          >
            <Octagon aria-hidden className="h-3.5 w-3.5" />
            {t("control.halt")}
          </Button>
          <span
            data-testid="control-status"
            className="machine-nums rounded-full border border-line bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-muted"
          >
            {t(`runstatus.${status}`)}
          </span>
        </div>
      </header>

      {/* Fetch-cycle path: PC → Memory → IR → { Micro-IR, PC incrementer }. */}
      <div className="flex flex-wrap items-center gap-2">
        {/* PC */}
        <CtlBox label={t("control.pc")} energized={actors.has("ctl:pc")} data-testid="ctl-pc">
          <BitSlotField
            value={shown.pc}
            length={5}
            groupEvery={0}
            editable={canEdit}
            energized={actors.has("ctl:pc")}
            label={t("control.stepSize")}
            onChange={(w) => setMachine({ pc: w & 31 })}
          />
        </CtlBox>

        <ControlArrow
          label={t("control.fetchArrow")}
          energized={kind === "fetch" && actors.has("ctl:pc")}
        />

        {/* Memory tap */}
        <CtlBox
          label={`M[${shown.memRW}]`}
          energized={kind === "fetch"}
          memory
          data-testid="ctl-mem"
        >
          <span className="machine-nums text-[12px] text-ink">
            {`@${shown.pc}`}
          </span>
        </CtlBox>

        <ControlArrow
          label={t("control.loadArrow")}
          energized={kind === "fetch" && actors.has("ctl:ir")}
        />

        {/* IR + disassembly */}
        <CtlBox label={t("control.ir")} energized={actors.has("ctl:ir")} data-testid="ctl-ir">
          <div className={cn("flex flex-wrap items-center gap-2", !hasIR && "opacity-40")}>
            <BitSlotField
              value={irValue}
              length={16}
              editable={false}
              energized={actors.has("ctl:ir")}
              label={t("control.ir")}
            />
            <InstructionField value={irValue} editable={false} energized={actors.has("ctl:ir")} />
          </div>
        </CtlBox>

        <ControlArrow
          label={t("control.decodeArrow")}
          energized={actors.has("microIR")}
        />

        {/* Micro-IR */}
        <CtlBox
          label={t("control.microIR")}
          energized={actors.has("microIR")}
          data-testid="ctl-microir"
        >
          <MicroIrView microIR={shown.microIR} energized={actors.has("microIR")} />
        </CtlBox>
      </div>
    </section>
  );
}

function CtlBox({
  label,
  energized,
  memory,
  children,
  ...data
}: {
  label: string;
  energized: boolean;
  memory?: boolean;
  children: React.ReactNode;
  ["data-testid"]?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border bg-surface px-2.5 py-1.5 transition-colors",
        energized
          ? "border-accent-control shadow-[0_0_0_3px_var(--accent-control-soft)]"
          : "border-line",
        memory && "border-accent-memory/40",
      )}
      {...data}
    >
      <span
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wider",
          energized ? "text-accent-control" : memory ? "text-accent-memory" : "text-ink-faint",
        )}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/** Fetch-cycle transfer arrow; the loop variant bends back (incrementer). */
function ControlArrow({
  label,
  energized,
  loop = false,
}: {
  label: string;
  energized: boolean;
  loop?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "flex flex-col items-center transition-colors",
        energized ? "text-accent-control" : "text-ink-faint/50",
      )}
    >
      <svg
        width="44"
        height={loop ? 30 : 16}
        viewBox={loop ? "0 0 44 30" : "0 0 44 16"}
        aria-hidden
        className={cn(energized && "energized-pulse")}
      >
        {loop ? (
          <path
            d="M2 4 H34 Q42 4 42 12 V26"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            markerEnd=""
          />
        ) : (
          <path
            d="M2 8 H36"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
        <path
          d={loop ? "M38 22 L42 29 L46 22" : "M34 4 L42 8 L34 12"}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={loop ? "translate(-2 0)" : ""}
        />
      </svg>
    </span>
  );
}

/** Six read-only mini fields mirroring the Micro-IR. */
function MicroIrView({ microIR, energized }: { microIR: MicroInst | null; energized: boolean }) {
  const t = useT();
  if (!microIR) {
    return (
      <span className="machine-nums text-[12px] tracking-widest text-ink-faint/60">
        {t("micro.unprogrammed")}
      </span>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {MICRO_IR_FIELDS.map(({ key, len }) => {
        const raw = microIR[key];
        const bits = /^[01]+$/.test(raw) ? parseInt(raw, 2) : 0;
        return (
          <span key={key} className="flex flex-col items-center gap-0.5">
            <span className="text-[9px] uppercase tracking-wide text-ink-faint">{key}</span>
            <BitSlotField
              value={bits}
              length={len}
              groupEvery={0}
              editable={false}
              energized={energized}
              label={`${t("control.microIR")} ${key}`}
            />
          </span>
        );
      })}
    </div>
  );
}
