import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-bus text-white border border-transparent hover:brightness-110 active:brightness-95",
  secondary:
    "bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-raised",
  ghost: "bg-transparent text-ink-muted border border-transparent hover:text-ink hover:bg-surface",
  danger:
    "bg-accent-danger text-white border border-transparent hover:brightness-110 active:brightness-95",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
};

/** Hand-rolled accessible button styled with theme tokens. */
export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium",
        "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
