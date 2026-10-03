import type { Base, Word } from "@/core/types";
import { toBase } from "@/core/numbers";

/**
 * Small latch box (ALU A / B / C input-output registers): label + the
 * latched value in the current base. Energized = value arriving.
 */
export type LatchBoxProps = {
  label: string;
  value: Word;
  base?: Base;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  energized?: boolean;
};

export function LatchBox({
  label,
  value,
  base = "-10",
  x = 0,
  y = 0,
  width = 130,
  height = 44,
  energized = false,
}: LatchBoxProps) {
  const stroke = energized ? "var(--accent-bus)" : "var(--border)";
  // Auto-fit: shrink the mono value font so any representation fits the box
  // (a 16-bit binary string is several times wider than a short decimal).
  const text = toBase(value, base);
  const labelWidth = label.length * 6 + 14;
  const avail = width - 20 - labelWidth;
  const fontSize = Math.max(8.5, Math.min(13, avail / (text.length * 0.62)));
  return (
    <g transform={`translate(${x},${y})`} data-component="latch" data-label={label} data-value={value}>
      <rect
        width={width}
        height={height}
        rx={6}
        fill="var(--surface)"
        stroke={stroke}
        strokeWidth={energized ? 1.8 : 1.2}
        style={{ filter: energized ? "drop-shadow(0 0 4px var(--accent-bus))" : undefined }}
      />
      <text
        x={10}
        y={height - 10}
        fill="var(--text-faint)"
        fontSize={10}
        letterSpacing={1}
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {label}
      </text>
      <text
        x={width - 10}
        y={height / 2 + 5}
        textAnchor="end"
        fill={energized ? "var(--accent-bus)" : "var(--text)"}
        fontSize={fontSize}
        fontWeight={600}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {text}
      </text>
    </g>
  );
}
