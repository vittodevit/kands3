import { useMemo } from "react";
import { create } from "zustand";
import { Trash2 } from "lucide-react";
import type { Base, Word } from "@/core/types";
import { shownState, useSession } from "@/state/sessionStore";
import { useSettings } from "@/state/settingsStore";
import { useT } from "@/i18n/useT";
import { BitSlotField } from "@/ui/fields/BitSlotField";
import { ValueField } from "@/ui/fields/ValueField";
import { InstructionField } from "@/ui/fields/InstructionField";
import { cn } from "@/lib/utils";

/** Per-cell display datatype — UI-only state, deliberately NOT in MachineState. */
type CellType = "auto" | "-10" | "10" | "2" | "inst";

type MemTypesState = {
  types: Record<number, CellType>;
  setType: (addr: number, t: CellType) => void;
};

/**
 * Per-cell display datatypes — UI-only state, deliberately NOT in
 * MachineState. Exported so the assembly editor can mark loaded
 * instruction cells (datatype "inst") as a quality-of-life touch.
 */
export const useMemTypes = create<MemTypesState>((set) => ({
  types: {},
  setType: (addr, t) => set((s) => ({ types: { ...s.types, [addr]: t } })),
}));

const TYPE_OPTIONS: readonly { value: CellType; labelKey: "memory.datatype.auto" | "memory.datatype.-10" | "memory.datatype.10" | "memory.datatype.2" | "memory.datatype.inst" }[] = [
  { value: "auto", labelKey: "memory.datatype.auto" },
  { value: "-10", labelKey: "memory.datatype.-10" },
  { value: "10", labelKey: "memory.datatype.10" },
  { value: "2", labelKey: "memory.datatype.2" },
  { value: "inst", labelKey: "memory.datatype.inst" },
];

/**
 * Main Memory stage — a full-height sidebar rail: one row per word
 * (address | value | datatype), a single selected R/W address (radio
 * semantics), per-cell datatype (Auto follows the global base), values that
 * auto-assemble in Inst mode, glow on the cell being read/written, and the
 * MM Bus readout in the header. The row list scrolls internally.
 */
export function MemoryStage() {
  const t = useT();
  const base = useSettings((s) => s.base);
  const features = useSettings((s) => s.features);

  const machine = useSession((s) => s.machine);
  const timeline = useSession((s) => s.timeline);
  const cursor = useSession((s) => s.cursor);
  const activeStep = useSession((s) => s.activeStep);
  const status = useSession((s) => s.status);
  const setMachine = useSession((s) => s.setMachine);
  const setMemoryValues = useSession((s) => s.setMemoryValues);

  // The shown machine: the timeline snapshot at the cursor, else the base.
  const shown = shownState({ machine, timeline, cursor });
  const actors = useMemo(() => new Set(activeStep?.actors ?? []), [activeStep]);
  const canEdit = status === "idle" || status === "done" || status === "halted";

  if (!features.memory) return null;

  const commitValue = (addr: number, w: Word) => {
    // Edits fork from the SHOWN state (apply-shown + edit → new base).
    const memory = [...shown.memory];
    memory[addr] = w;
    setMachine({ memory });
  };

  const selectRW = (addr: number) => {
    if (shown.memRW !== addr) setMachine({ memRW: addr });
  };

  return (
    <section
      aria-label={t("memory.title")}
      data-stage="memory"
      className="flex h-full min-h-0 flex-col bg-surface-raised"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          {t("memory.title")}
        </h2>
        {activeStep?.weight === 4 && (
          <span
            className="machine-nums rounded-full bg-accent-memory-soft px-2 py-0.5 text-[11px] font-semibold text-accent-memory"
            data-testid="mm-bus"
          >
            {t("memory.slowWrite")}
          </span>
        )}
        <button
          type="button"
          className={cn(
            "ml-auto inline-flex h-6 items-center gap-1 rounded-md border border-line bg-surface px-2",
            "text-[11px] font-medium text-ink-muted transition-colors",
            "hover:border-accent-danger/60 hover:text-accent-danger",
          )}
          title={t("memory.wipeHint")}
          aria-label={t("memory.wipe")}
          data-testid="memory-wipe"
          onClick={() => {
            // Wipe: all 32 words → 0 (NOP); cell display modes reset to Auto.
            setMemoryValues(Array.from({ length: 32 }, () => 0));
            useMemTypes.setState({ types: {} });
          }}
        >
          <Trash2 aria-hidden className="h-3 w-3" />
          {t("memory.wipe")}
        </button>
      </header>

      {/* Row list — the rail's scrollable body */}
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        role="radiogroup"
        aria-label={t("memory.rwSelect", { addr: shown.memRW })}
      >
        <table className="w-full border-separate border-spacing-0">
          <tbody>
            {Array.from({ length: 32 }, (_, addr) => (
              <MemoryRow
                key={addr}
                addr={addr}
                value={shown.memory[addr] ?? 0}
                base={base}
                showInst={features.control}
                isRW={shown.memRW === addr}
                energized={actors.has(`mem:${addr}`)}
                slowWrite={activeStep?.weight === 4 && actors.has(`mem:${addr}`)}
                editable={canEdit}
                onSelect={() => selectRW(addr)}
                onCommit={(w) => commitValue(addr, w)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type MemoryRowProps = {
  addr: number;
  value: Word;
  base: Base;
  showInst: boolean;
  isRW: boolean;
  energized: boolean;
  slowWrite: boolean;
  editable: boolean;
  onSelect: () => void;
  onCommit: (w: Word) => void;
};

function MemoryRow({
  addr,
  value,
  base,
  showInst,
  isRW,
  energized,
  slowWrite,
  editable,
  onSelect,
  onCommit,
}: MemoryRowProps) {
  const t = useT();
  const type = useMemTypes((s) => s.types[addr] ?? "auto");
  const setType = useMemTypes((s) => s.setType);
  const effectiveType: CellType = type === "inst" && !showInst ? "auto" : type;
  const effBase: Base = effectiveType === "auto" || effectiveType === "inst" ? base : effectiveType;

  return (
    <tr
      data-mem-cell={addr}
      data-testid={`mem-cell-${addr}`}
      className={cn(
        "transition-colors",
        isRW && "bg-accent-memory-soft/40",
        energized && "energized-pulse bg-accent-memory-soft/60",
        slowWrite && "bg-accent-memory-soft",
      )}
    >
      {/* Address gutter entry + R/W radio (radio semantics). */}
      <td className="w-10 border-b border-line/60 py-1 pl-2 align-middle">
        <button
          type="button"
          role="radio"
          aria-checked={isRW}
          aria-label={isRW ? t("memory.rwSelected", { addr }) : t("memory.rwSelect", { addr })}
          onClick={onSelect}
          className={cn(
            "machine-nums flex h-6 w-8 items-center justify-center rounded text-[11px] font-semibold",
            isRW
              ? "bg-accent-memory text-base"
              : "bg-surface-sunken text-ink-muted hover:bg-surface hover:text-ink",
          )}
        >
          {addr}
        </button>
      </td>

      <td className="border-b border-line/60 px-1.5 py-1 align-middle">
        <div className="min-w-0">
          {effectiveType === "inst" ? (
            <InstructionField
              value={value}
              editable={editable}
              onChange={onCommit}
              energized={energized}
              label={t("memory.datatype", { addr })}
            />
          ) : effBase === "2" ? (
            // Binary (explicit or inferred via Auto): the app-wide bit slots.
            <BitSlotField
              value={value}
              editable={editable}
              onChange={onCommit}
              energized={energized}
              compact
              label={t("memory.datatype", { addr })}
            />
          ) : (
            <ValueField
              value={value}
              base={effBase}
              editable={editable}
              onChange={onCommit}
              energized={energized}
              label={t("memory.datatype", { addr })}
            />
          )}
        </div>
      </td>

      <td className="w-[4.6rem] border-b border-line/60 pr-2 align-middle">
        <select
          value={effectiveType}
          onChange={(e) => setType(addr, e.target.value as CellType)}
          aria-label={t("memory.datatype", { addr })}
          className={cn(
            "h-6 w-full cursor-pointer rounded border-0 bg-surface-sunken px-1 text-[10px] text-ink-muted",
            "outline-none hover:text-ink focus-visible:ring-1 focus-visible:ring-ring",
          )}
        >
          {TYPE_OPTIONS.filter((o) => o.value !== "inst" || showInst).map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.labelKey)}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}
