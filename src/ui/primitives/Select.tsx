import { useId, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  options: readonly SelectOption[];
  /** Visible label rendered above the select; also the accessible name. */
  label?: string;
  hideLabel?: boolean;
};

/**
 * Styled native <select> — native selects are keyboard- and screen-reader-
 * accessible for free, which matters more than custom popovers here.
 */
export function Select({ options, label, hideLabel, className, id, ...props }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className="inline-flex flex-col gap-1">
      {label && (
        <label
          htmlFor={selectId}
          className={cn(
            "text-[11px] font-medium uppercase tracking-wider text-ink-faint",
            hideLabel && "sr-only",
          )}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            "h-8 appearance-none rounded-lg border border-line bg-surface pl-2.5 pr-7",
            "text-sm text-ink transition-colors duration-150",
            "hover:border-line-strong focus-visible:border-accent-bus",
            className,
          )}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint"
        />
      </div>
    </div>
  );
}
