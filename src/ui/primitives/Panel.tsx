import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type PanelProps = {
  title: ReactNode;
  /** Optional right-side header actions. */
  actions?: ReactNode;
  children?: ReactNode;
  /** Start expanded (uncontrolled collapsible). */
  defaultOpen?: boolean;
  /** Render without collapse affordance. */
  nonCollapsible?: boolean;
  className?: string;
  bodyClassName?: string;
  ["data-panel"]?: string;
};

/** Raised surface panel with hairline border, soft shadow, optional collapse. */
export function Panel({
  title,
  actions,
  children,
  defaultOpen = true,
  nonCollapsible,
  className,
  bodyClassName,
  ...data
}: PanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = nonCollapsible ? true : open;
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface-raised",
        "shadow-raised",
        className,
      )}
      {...data}
    >
      <header className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
        <div className="flex min-w-0 items-center gap-2">
          {!nonCollapsible && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={isOpen}
              className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint hover:text-ink hover:bg-surface"
              aria-label={isOpen ? "Collapse panel" : "Expand panel"}
            >
              <ChevronDown
                aria-hidden
                className={cn("h-4 w-4 transition-transform duration-150", !isOpen && "-rotate-90")}
              />
            </button>
          )}
          <h2 className="truncate text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {title}
          </h2>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </header>
      {isOpen && (
        <div className={cn("min-h-0 flex-1 overflow-auto p-3", bodyClassName)}>{children}</div>
      )}
    </section>
  );
}
