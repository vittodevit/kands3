import { useState } from "react";
import { ArrowDown, Eraser, Play } from "lucide-react";
import type { MicroInst } from "@/core/types";
import { toBits } from "@/core/numbers";
import { encodeFromKnobs } from "@/core/microcode";
import { emptyMicroInst } from "@/core/machine";
import { shownState, useSession } from "@/state/sessionStore";
import { useSettings } from "@/state/settingsStore";
import { useT } from "@/i18n/useT";
import { BitSlotField } from "@/ui/fields/BitSlotField";
import { Button, IconButton, Tooltip } from "@/ui/primitives";
import { cn } from "@/lib/utils";

const FIELDS = [
  { key: "AAddr", len: 2, labelKey: "micro.field.AAddr" },
  { key: "BAddr", len: 2, labelKey: "micro.field.BAddr" },
  { key: "ALU", len: 2, labelKey: "micro.field.ALU" },
  { key: "CAddr", len: 2, labelKey: "micro.field.CAddr" },
  { key: "MMAddr", len: 5, labelKey: "micro.field.MMAddr" },
  { key: "SW", len: 4, labelKey: "micro.field.SW" },
] as const;

/**
 * The one true column grid: identical fixed tracks for the header row AND
 * every data row, so columns can never drift apart when a cell's content
 * changes (xx placeholder ↔ bit slots ↔ edit input). Content is centered
 * within its column. Tracks: row# | 6 fields | capture | clear.
 */
const COLS = "grid grid-cols-[1.6rem_repeat(6,minmax(0,1fr))_1.7rem_1.7rem] gap-x-0 divide-x divide-line/50 gap-y-0";

/**
 * Microprogram store stage: 5 fixed rows × 6 fields (AAddr BAddr ALU CAddr
 * = 2 bits, MMAddr = 5 bits, SW = 4 bits), each rendered as a mini
 * BitSlotField. Unprogrammed fields show a dimmed dashed "xx" placeholder
 * that accepts typing. Per-row capture button reads the current knobs and
 * switches (encodeFromKnobs) into that row; Execute runs rows 0→4.
 */
export function MicroprogStage() {
  const t = useT();
  const features = useSettings((s) => s.features);

  const machine = useSession((s) => s.machine);
  const timeline = useSession((s) => s.timeline);
  const cursor = useSession((s) => s.cursor);
  const activeStep = useSession((s) => s.activeStep);
  const status = useSession((s) => s.status);
  const setMachine = useSession((s) => s.setMachine);
  const run = useSession((s) => s.run);

  const shown = shownState({ machine, timeline, cursor });
  const canEdit = status === "idle" || status === "done" || status === "halted";

  if (!features.microprog) return null;

  const writeRow = (row: number, patch: Partial<MicroInst>) => {
    const micro = shown.micro.map((m, i) => (i === row ? { ...m, ...patch } : m));
    setMachine({ micro });
  };

  const captureRow = (row: number) => {
    writeRow(row, encodeFromKnobs(shown));
  };

  const clearRow = (row: number) => {
    const micro = shown.micro.map((m, i) => (i === row ? emptyMicroInst() : m));
    setMachine({ micro });
  };

  return (
    <section
      aria-label={t("micro.title")}
      data-stage="microprog"
      className="flex flex-col gap-2 rounded-xl border border-line bg-surface-raised p-3 shadow-raised"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          {t("micro.title")}
        </h2>
        <Button
          size="sm"
          variant="primary"
          onClick={() => run("micro")}
          disabled={!canEdit}
          title={t("micro.executeHint")}
          data-testid="micro-execute"
        >
          <Play aria-hidden className="h-3.5 w-3.5" />
          {t("micro.execute")}
        </Button>
      </header>

      {/* Column headers — same fixed tracks as the rows; every title centered */}
      <div className={cn(COLS, "border-b border-line pb-1.5")}>
        <span />
        {FIELDS.map((f) => (
          <span key={f.key} className="flex min-w-0 justify-center px-1">
            <Tooltip content={f.key === "SW" ? t("micro.swHint") : t(f.labelKey)}>
              <span className="cursor-help text-center text-[10px] font-semibold uppercase tracking-wider text-accent-memory">
                {t(f.labelKey)}
              </span>
            </Tooltip>
          </span>
        ))}
        <span />
        <span />
      </div>

      {/* Rows — identical tracks; every cell centered in its column */}
      <ol className="flex flex-col gap-1">
        {shown.micro.map((rowInst, i) => {
          const driving = activeStep?.actors.includes(`micro:${i}`) ?? false;
          return (
            <li
              key={i}
              data-micro-row={i}
              aria-label={t("micro.row", { row: i })}
              className={cn(
                COLS,
                "items-center rounded-lg border px-1.5 py-1 transition-colors",
                driving
                  ? "border-accent-memory bg-accent-memory-soft/50"
                  : "border-transparent",
              )}
            >
              <span className="machine-nums px-1 text-center text-[11px] font-semibold text-ink-faint">
                µ{i}
              </span>
              {FIELDS.map((f) => (
                <div key={f.key} className="flex min-w-0 justify-center px-1">
                  <MicroField
                    field={rowInst[f.key]}
                    len={f.len}
                    label={t(f.labelKey)}
                    ariaLabel={t("micro.fieldEdit", { field: t(f.labelKey), row: i })}
                    energized={driving}
                    editable={canEdit}
                    onCommit={(v) => writeRow(i, { [f.key]: v } as Partial<MicroInst>)}
                  />
                </div>
              ))}
              <IconButton
                aria-label={t("micro.capture", { row: i })}
                onClick={() => captureRow(i)}
                disabled={!canEdit}
                className="h-6 w-6 justify-self-center text-accent-memory hover:bg-accent-memory-soft"
                data-testid={`micro-capture-${i}`}
              >
                <ArrowDown aria-hidden className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                aria-label={t("micro.clear", { row: i })}
                onClick={() => clearRow(i)}
                disabled={!canEdit}
                className="h-6 w-6 justify-self-center"
                data-testid={`micro-clear-${i}`}
              >
                <Eraser aria-hidden className="h-3.5 w-3.5" />
              </IconButton>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

type MicroFieldProps = {
  field: string;
  len: number;
  label: string;
  ariaLabel: string;
  energized: boolean;
  editable: boolean;
  onCommit: (value: string) => void;
};

const isBits = (s: string, len: number): boolean => new RegExp(`^[01]{${len}}$`).test(s);

/**
 * One microinstruction field: a mini BitSlotField once programmed, or a
 * dimmed dashed "xx" placeholder (click to type bits or "xx") when
 * unprogrammed. Invalid input shows danger styling — never silently kept.
 */
function MicroField({ field, len, label, ariaLabel, energized, editable, onCommit }: MicroFieldProps) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(false);

  const unprogrammed = !isBits(field, len);

  const beginEdit = () => {
    if (!editable) return;
    setDraft(unprogrammed ? "" : field);
    setError(false);
    setEditing(true);
  };

  const commit = () => {
    const v = draft.trim().toLowerCase();
    if (/^x+$/.test(v)) {
      onCommit("xx");
      setError(false);
      setEditing(false);
      return;
    }
    if (isBits(v, len)) {
      onCommit(v);
      setError(false);
      setEditing(false);
      return;
    }
    setError(true); // keep editing — no silent fallback
  };

  if (unprogrammed && !editing) {
    return (
      <button
        type="button"
        onClick={beginEdit}
        aria-disabled={!editable}
        aria-label={ariaLabel}
        title={t("micro.fieldError", { length: len })}
        data-micro-field={`${label}:xx`}
        className={cn(
          "machine-nums flex h-7 items-center justify-center rounded-md border border-dashed px-1.5 text-[12px] tracking-widest",
          editable ? "cursor-text text-ink-faint hover:border-line-strong hover:text-ink" : "cursor-default text-ink-faint/60",
          energized && "energized-pulse",
          error && "border-accent-danger text-accent-danger",
        )}
      >
        {t("micro.unprogrammed")}
      </button>
    );
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setEditing(false);
            setError(false);
          }
        }}
        onBlur={commit}
        spellCheck={false}
        aria-label={ariaLabel}
        title={t("micro.fieldError", { length: len })}
        className={cn(
          "machine-nums h-7 w-14 rounded-md border bg-surface-sunken px-1.5 text-[12px] text-ink outline-none",
          error ? "border-accent-danger text-accent-danger" : "border-accent-bus",
        )}
      />
    );
  }

  // Programmed: mini BitSlotField of the exact field width.
  return (
    <BitSlotField
      value={parseInt(field, 2)}
      length={len}
      groupEvery={0}
      editable={editable}
      energized={energized}
      label={ariaLabel}
      onChange={(w) => onCommit(toBits(w, len))}
    />
  );
}
