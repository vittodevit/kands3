import { useEffect, useRef, useState } from "react";
import type { Word } from "@/core/types";
import { signed, toBits } from "@/core/numbers";
import { Tooltip } from "@/ui/primitives";
import { translate as t } from "@/i18n/useT";
import { cn } from "@/lib/utils";

export type BitSlotFieldProps = {
  value: Word;
  onChange?: (w: Word) => void;
  editable?: boolean;
  /** Energized phase: bits that changed since the last value pulse. */
  energized?: boolean;
  /** Bit count (16 for words, 2/4/5 for microinstruction fields). */
  length?: number;
  /** Insert a wider gap every N bits (nibbles). */
  groupEvery?: number;
  /** Compact cell sizing for tight rows (e.g. the memory sidebar). */
  compact?: boolean;
  label?: string;
  className?: string;
};

/**
 * Binary bit-slot field: one monospace cell per bit, nibble gaps, click to
 * flip, keyboard 0/1/Space/Enter + arrow navigation, hover tooltip with place
 * value and signed/unsigned interpretation.
 */
export function BitSlotField({
  value,
  onChange,
  editable = false,
  energized = false,
  length = 16,
  groupEvery = 4,
  compact = false,
  label,
  className,
}: BitSlotFieldProps) {
  const bits = toBits(value, length);
  const [focusIndex, setFocusIndex] = useState(0);
  const [hotBits, setHotBits] = useState<Set<number>>(new Set());
  const prevValue = useRef<Word>(value);

  // Energized pulse: compare with previous value; changed bits glow briefly.
  useEffect(() => {
    const prev = toBits(prevValue.current, length);
    const changed = new Set<number>();
    for (let i = 0; i < length; i++) {
      if (prev[i] !== bits[i]) changed.add(i);
    }
    prevValue.current = value;
    if (energized && changed.size > 0) {
      setHotBits(changed);
      const timer = setTimeout(() => setHotBits(new Set()), 700);
      return () => clearTimeout(timer);
    }
    setHotBits(new Set());
  }, [value, energized, length]); // eslint-disable-line react-hooks/exhaustive-deps

  const setBit = (displayIndex: number, to: 0 | 1) => {
    if (!editable || !onChange) return;
    const bitNumber = length - 1 - displayIndex;
    const mask = 1 << bitNumber;
    const next = to === 1 ? value | mask : value & ~mask;
    if (next !== value) onChange(next);
  };

  const flipBit = (displayIndex: number) => {
    if (!editable || !onChange) return;
    const bitNumber = length - 1 - displayIndex;
    onChange(value ^ (1 << bitNumber));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const key = e.key;
    if (key === "ArrowLeft" || key === "ArrowUp") {
      setFocusIndex((i) => Math.max(0, i - 1));
      e.preventDefault();
    } else if (key === "ArrowRight" || key === "ArrowDown") {
      setFocusIndex((i) => Math.min(length - 1, i + 1));
      e.preventDefault();
    } else if (key === "Home") {
      setFocusIndex(0);
      e.preventDefault();
    } else if (key === "End") {
      setFocusIndex(length - 1);
      e.preventDefault();
    } else if (key === "0") {
      setBit(focusIndex, 0);
      e.preventDefault();
    } else if (key === "1") {
      setBit(focusIndex, 1);
      e.preventDefault();
    }
    // Space / Enter fall through to the focused <button>'s native click → flip.
  };

  return (
    <div
      role="group"
      aria-label={label ?? t("field.bits.label", { length })}
      onKeyDown={onKeyDown}
      className={cn("inline-flex items-center", compact ? "gap-[2px]" : "gap-[3px]", energized && "energized-pulse rounded-md", className)}
      data-value={value}
    >
      {Array.from({ length }, (_, d) => {
        const char = bits[d] ?? "0";
        const bitNumber = length - 1 - d;
        const isOne = char === "1";
        const hot = hotBits.has(d);
        // Wider gap before the start of each new group (nibble).
        const gap = groupEvery > 0 && d > 0 && (length - d) % groupEvery === 0 ? (compact ? "ml-[4px]" : "ml-2") : "";
        return (
          <Tooltip
            key={d}
            className={gap}
            content={
              <span className="machine-nums">
                {t("field.bits.placeValue", { index: bitNumber, value: 2 ** bitNumber })}
                <br />
                {t("field.bits.unsigned", { value })}
                <br />
                {t("field.bits.signed", { value: signed(value) })}
              </span>
            }
          >
            <button
              type="button"
              tabIndex={d === focusIndex ? 0 : -1}
              aria-label={t("field.bits.bitLabel", { index: bitNumber })}
              aria-disabled={!editable || !onChange}
              onClick={() => flipBit(d)}
              onFocus={() => setFocusIndex(d)}
              className={cn(
                "machine-nums rounded-md border text-center transition-colors duration-150",
                compact ? "h-6 w-[15px] text-[10px] leading-6" : "h-7 w-[22px] text-[13px] leading-7",
                isOne
                  ? "border-accent-bus/50 bg-accent-bus-soft text-accent-bus"
                  : "border-line bg-surface-sunken text-ink-faint",
                hot && "energized-pulse border-accent-bus text-accent-bus",
                (editable && onChange ? "hover:border-line-strong cursor-pointer" : "cursor-default"),
              )}
            >
              {char}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
