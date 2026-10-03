import type { Base, Word } from "@/core/types";
import { toBase } from "@/core/numbers";

/** Small mono label+value pill for buses floating on the SVG canvas. */
export type ValueTagProps = {
  label: string;
  value: Word;
  base?: Base;
  x?: number;
  y?: number;
  energized?: boolean;
  /** Color token override for the energized state (e.g. memory green). */
  energizedColor?: string;
};

export function ValueTag({
  label,
  value,
  base = "-10",
  x = 0,
  y = 0,
  energized = false,
  energizedColor = "var(--accent-bus)",
}: ValueTagProps) {
  const text = toBase(value, base);
  const w = 26 + text.length * 8 + label.length * 7;
  const color = energized ? energizedColor : "var(--text-muted)";
  return (
    <g transform={`translate(${x},${y})`} data-component="value-tag" data-label={label} data-value={value}>
      <rect
        width={w}
        height={22}
        rx={11}
        fill="var(--surface-raised)"
        stroke={energized ? energizedColor : "var(--border)"}
        strokeWidth={energized ? 1.5 : 1}
        opacity={0.97}
        style={energized ? { filter: `drop-shadow(0 0 3px ${energizedColor})` } : undefined}
      />
      <text x={12} y={15} fill={color} fontSize={11} style={{ fontFamily: "var(--font-mono)" }}>
        <tspan fill="var(--text-faint)" fontWeight={600}>
          {label}
        </tspan>
        <tspan dx={6}>{text}</tspan>
      </text>
    </g>
  );
}
