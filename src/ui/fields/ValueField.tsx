import { useState } from "react";
import type { Base, Word } from "@/core/types";
import { parseValue, toBase } from "@/core/numbers";
import { translate as t } from "@/i18n/useT";
import { cn } from "@/lib/utils";

export type ValueFieldProps = {
  value: Word;
  base: Base;
  onChange?: (w: Word) => void;
  editable?: boolean;
  /** Energized phase (accent pulse) — "value arriving". */
  energized?: boolean;
  label?: string;
  className?: string;
};

/**
 * Plain numeric field for buses/latches/registers, rendered per the current
 * base (±10 / 10 / 2) with the same commit-validation pipeline as the other
 * fields: invalid input shows a danger outline + message, never a silent
 * fallback value.
 */
export function ValueField({
  value,
  base,
  onChange,
  editable = false,
  energized = false,
  label,
  className,
}: ValueFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    const w = parseValue(draft.trim(), base);
    if (w === null) {
      setError(t("field.value.error", { base, text: draft.trim() }));
      return;
    }
    setError(null);
    setEditing(false);
    if (w !== value) onChange?.(w);
  };

  const canEdit = editable && !!onChange;

  return (
    <div className={cn("inline-flex min-w-0 flex-col gap-1", className)} data-value={value}>
      <div
        role="group"
        aria-label={label ?? t("field.value.label")}
        className={cn(
          "inline-flex h-7 min-w-24 items-center rounded-md border border-line bg-surface-sunken px-2.5",
          energized && !editing && "energized-pulse",
          error && "border-accent-danger/60",
        )}
      >
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setEditing(false);
                setError(null);
              }
            }}
            onBlur={commit}
            spellCheck={false}
            aria-label={t("field.value.edit")}
            className={cn(
              "machine-nums h-full w-full bg-transparent text-[13px] text-ink outline-none",
              error && "text-accent-danger",
            )}
          />
        ) : (
          <button
            type="button"
            aria-disabled={!canEdit}
            onClick={() => {
              if (canEdit) {
                setDraft(toBase(value, base));
                setError(null);
                setEditing(true);
              }
            }}
            className={cn(
              "machine-nums w-full text-left text-[13px]",
              energized ? "text-accent-bus" : "text-ink",
              canEdit ? "cursor-text" : "cursor-default",
            )}
          >
            {toBase(value, base)}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-accent-danger" data-testid="value-error">
          {error}
        </p>
      )}
    </div>
  );
}
