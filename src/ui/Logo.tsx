import logoUrl from "@/assets/logo.svg";

/**
 * K&S 3 wordmark (outlined vector, theme-independent brand colors) used in
 * the navbar. Served as an inline-capable SVG asset so it stays crisp.
 */
export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <img
      src={logoUrl}
      alt="Knob & Switch Computer 3"
      className={className}
      draggable={false}
    />
  );
}
