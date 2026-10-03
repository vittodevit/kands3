import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Required — icon-only buttons must be announced to screen readers. */
  "aria-label": string;
  children: ReactNode;
};

/** Square icon-only button with mandatory accessible label. */
export function IconButton({ className, children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg",
        "text-ink-muted hover:text-ink hover:bg-surface border border-transparent hover:border-line",
        "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
