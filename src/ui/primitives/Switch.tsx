import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Screen-reader label (or wrap children for a visible label). */
  "aria-label"?: string;
  children?: ReactNode;
  className?: string;
};

/**
 * Accessible toggle switch (role="switch"). Also used in "chip" form with
 * children as the visible label by the AppShell feature toggles.
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  children,
  className,
  ...aria
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border text-sm font-medium",
        "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
        checked
          ? "border-accent-bus/60 bg-accent-bus-soft text-ink"
          : "border-line bg-surface text-ink-muted hover:border-line-strong",
        children ? "h-7 px-2.5" : "h-5 w-9 shrink-0 px-[3px]",
        className,
      )}
      {...aria}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-[14px] w-7 shrink-0 items-center rounded-full transition-colors duration-150",
          checked ? "bg-accent-bus" : "bg-line-strong/60",
        )}
      >
        <span
          className={cn(
            "absolute h-[10px] w-[10px] rounded-full bg-base shadow-sm",
            "left-[2px] transition-transform duration-150",
            checked && "translate-x-[12px]",
          )}
        />
      </span>
    </button>
  );
}
