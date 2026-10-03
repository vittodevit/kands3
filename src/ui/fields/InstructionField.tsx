import { useState } from "react";
import type { Word } from "@/core/types";
import { toBits } from "@/core/numbers";
import { assemble, disassemble } from "@/core/assembler";
import { translate as t } from "@/i18n/useT";
import { cn } from "@/lib/utils";

export type InstructionFieldProps = {
  value: Word;
  onChange?: (w: Word) => void;
  editable?: boolean;
  /** Energized phase (accent pulse). */
  energized?: boolean;
  label?: string;
  className?: string;
};

/** Inclusive bit range [hi, lo] (bit 0 = LSB). */
type BitRange = { hi: number; lo: number };

/**
 * Operand bit ranges per mnemonic, derived from the ISA encodings (ARCH §2):
 * opcodes occupy the top bits, then register/address operands in order.
 */
const OPERAND_RANGES: Record<string, readonly BitRange[]> = {
  LOAD: [{ hi: 6, lo: 5 }, { hi: 4, lo: 0 }],
  STORE: [{ hi: 6, lo: 5 }, { hi: 4, lo: 0 }],
  MOVE: [{ hi: 3, lo: 2 }, { hi: 1, lo: 0 }],
  ADD: [{ hi: 5, lo: 4 }, { hi: 3, lo: 2 }, { hi: 1, lo: 0 }],
  SUB: [{ hi: 5, lo: 4 }, { hi: 3, lo: 2 }, { hi: 1, lo: 0 }],
  AND: [{ hi: 5, lo: 4 }, { hi: 3, lo: 2 }, { hi: 1, lo: 0 }],
  OR: [{ hi: 5, lo: 4 }, { hi: 3, lo: 2 }, { hi: 1, lo: 0 }],
  BRANCH: [{ hi: 4, lo: 0 }],
  BZERO: [{ hi: 4, lo: 0 }],
  BNEG: [{ hi: 4, lo: 0 }],
};

/**
 * Instruction field: syntax-highlighted disassembly (mnemonic = accent,
 * Rn = secondary, address = memory accent, invalid = danger), editable with
 * live assemble on commit and visible errors (never a silent HALT), and a
 * mini bit-ruler that lights up the hovered operand's bit range.
 */
export function InstructionField({
  value,
  onChange,
  editable = false,
  energized = false,
  label,
  className,
}: InstructionFieldProps) {
  const { text, valid } = disassemble(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hoveredOperand, setHoveredOperand] = useState<number | null>(null);

  const tokens = valid ? text.split(" ") : [t("field.instruction.invalid")];
  const mnemonic = tokens[0] ?? "";
  const ranges = valid ? (OPERAND_RANGES[mnemonic] ?? []) : [];
  const hoveredRange =
    hoveredOperand !== null && ranges[hoveredOperand] ? ranges[hoveredOperand] : null;

  const beginEdit = () => {
    if (!editable) return;
    setDraft(text);
    setError(null);
    setEditing(true);
  };

  const commit = () => {
    const w = assemble(draft.trim());
    if (w === null) {
      setError(t("field.instruction.error", { text: draft.trim() }));
      return;
    }
    setError(null);
    setEditing(false);
    if (w !== value) onChange?.(w);
  };

  const cancel = () => {
    setEditing(false);
    setError(null);
  };

  return (
    <div className={cn("inline-flex min-w-0 flex-col gap-1", className)} data-value={value}>
      <div
        role="group"
        aria-label={label ?? t("field.instruction.label")}
        data-valid={valid}
        className={cn(
          "inline-flex h-7 min-w-40 items-center rounded-md border border-line bg-surface-sunken px-2.5",
          energized && !editing && "energized-pulse",
          !valid && "border-accent-danger/50",
        )}
      >
        {editing ? (
          <>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") cancel();
              }}
              onBlur={commit}
              spellCheck={false}
              aria-label={t("field.instruction.edit")}
              className={cn(
                "machine-nums h-full w-56 bg-transparent text-[13px] text-ink outline-none",
                error && "text-accent-danger",
              )}
              placeholder={t("field.instruction.hint")}
            />
          </>
        ) : (
          <button
            type="button"
            onClick={beginEdit}
            aria-disabled={!editable}
            aria-label={`${t("field.instruction.label")}: ${text}`}
            className={cn(
              "machine-nums flex h-full items-center gap-2 rounded text-[13px]",
              editable ? "cursor-text hover:text-ink" : "cursor-default",
              !valid && "text-accent-danger",
            )}
          >
            {tokens.map((tok, i) => {
              if (i === 0) {
                return (
                  <span
                    key={i}
                    className={cn("font-semibold", valid ? "text-accent-bus" : "text-accent-danger")}
                  >
                    {tok}
                  </span>
                );
              }
              const isReg = /^R[0-3]$/.test(tok);
              return (
                <span
                  key={i}
                  onMouseEnter={() => valid && setHoveredOperand(i - 1)}
                  onMouseLeave={() => setHoveredOperand(null)}
                  className={cn(
                    "transition-colors",
                    isReg ? "text-accent-reg" : "text-accent-memory",
                    hoveredOperand === i - 1 && "underline underline-offset-4",
                  )}
                >
                  {tok}
                </span>
              );
            })}
          </button>
        )}
      </div>

      {/* Mini bit-ruler: hovered operand's bit range lights up. */}
      <div aria-hidden className="flex select-none gap-[2px] pl-0.5" data-testid="bit-ruler">
        {Array.from({ length: 16 }, (_, d) => {
          const bitNumber = 15 - d;
          const lit =
            hoveredRange !== null && bitNumber <= hoveredRange.hi && bitNumber >= hoveredRange.lo;
          const isOne = toBits(value, 16)[d] === "1";
          return (
            <span
              key={d}
              className={cn(
                "machine-nums flex h-3 w-[13px] items-center justify-center rounded-[3px] text-[8px] leading-none",
                lit
                  ? "bg-accent-bus text-base"
                  : isOne
                    ? "bg-accent-bus-soft text-accent-bus"
                    : "bg-surface-sunken text-ink-faint",
                (d > 0 && (16 - d) % 4 === 0 ? "ml-[3px]" : ""),
              )}
            >
              {isOne ? 1 : 0}
            </span>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-xs text-accent-danger" data-testid="instruction-error">
          {error}
        </p>
      )}
    </div>
  );
}
