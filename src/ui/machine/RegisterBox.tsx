import type { Base, Word } from "@/core/types";
import { BitSlotField } from "@/ui/fields/BitSlotField";
import { ValueField } from "@/ui/fields/ValueField";

/**
 * One register row inside the register bank: label + editable value field.
 * The field itself is the shared HTML widget (BitSlotField in binary mode,
 * ValueField otherwise), embedded via foreignObject so the whole datapath
 * stays one responsive SVG composition. `energized` = read glow,
 * `writePulse` = write-target highlight.
 */
export type RegisterBoxProps = {
  label: string;
  value: Word;
  base: Base;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  energized?: boolean;
  writePulse?: boolean;
  editable?: boolean;
  onWrite?: (w: Word) => void;
};

export function RegisterBox({
  label,
  value,
  base,
  x = 0,
  y = 0,
  width = 440,
  height = 34,
  energized = false,
  writePulse = false,
  editable = false,
  onWrite,
}: RegisterBoxProps) {
  const stroke = energized
    ? "var(--accent-bus)"
    : writePulse
      ? "var(--accent-memory)"
      : "var(--border)";
  return (
    <g transform={`translate(${x},${y})`} data-component="register" data-label={label} data-value={value}>
      <rect
        width={width}
        height={height}
        rx={6}
        fill="var(--surface)"
        stroke={stroke}
        strokeWidth={energized || writePulse ? 1.8 : 1.2}
        style={{
          filter: energized ? "drop-shadow(0 0 4px var(--accent-bus))" : undefined,
        }}
      />
      <text
        x={12}
        y={height / 2 + 4}
        fill={energized ? "var(--accent-bus)" : "var(--text-muted)"}
        fontSize={12.5}
        fontWeight={600}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </text>
      <foreignObject
        x={base === "2" ? 52 : 48}
        y={height % 2}
        width={width - (base === "2" ? 60 : 56)}
        height={height}
        style={{ overflow: "visible" }}
      >
        <div style={{ height: "100%", display: "flex", alignItems: "center" }}>
          {base === "2" ? (
            <BitSlotField
              value={value}
              editable={editable}
              onChange={onWrite}
              energized={energized}
              label={`${label} bits`}
              className="origin-left scale-[0.72]"
            />
          ) : (
            <ValueField
              value={value}
              base={base}
              editable={editable}
              onChange={onWrite}
              energized={energized}
              label={label}
            />
          )}
        </div>
      </foreignObject>
    </g>
  );
}
