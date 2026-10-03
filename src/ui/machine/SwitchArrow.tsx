import { motion } from "motion/react";
import { SPRING } from "@/anim/tokens";

/**
 * Open/closed arrow switch (remake of upArrow/downArrow/bend/leftArrow
 * {Open,Closed} GIFs). Closed = the arrow path connects end-to-end; open =
 * the path retracts and the arrowhead detaches. Energized = accent glow.
 */
export type SwitchDir = "up" | "down" | "bend" | "left";

export type SwitchArrowProps = {
  dir: SwitchDir;
  /** true = OPEN (disconnected). */
  open: boolean;
  x?: number;
  y?: number;
  /** Overall length of the arrow; bend uses it for both legs. */
  length?: number;
  energized?: boolean;
  label?: string;
  /** Side the label sits on for up/down arrows (default: right). */
  labelSide?: "left" | "right";
  disabled?: boolean;
  onChange?: (open: boolean) => void;
};

export function SwitchArrow({
  dir,
  open,
  x = 0,
  y = 0,
  length = 46,
  energized = false,
  label,
  /** Side the label sits on for up/down arrows (default: right). */
  labelSide = "right",
  disabled = false,
  onChange,
}: SwitchArrowProps) {
  const enabled = !disabled && !!onChange;
  const L = length;
  const half = L / 2;
  const color = energized ? "var(--accent-bus)" : open ? "var(--accent-rest)" : "var(--text-muted)";

  // Path geometry per direction, drawn pointing along the data direction.
  let path = "";
  let head = "";
  switch (dir) {
    case "up":
      path = `M 0 ${half} L 0 ${-half + 8}`;
      head = `${-6},${-half + 9} 6,${-half + 9} 0,${-half}`;
      break;
    case "down":
      path = `M 0 ${-half} L 0 ${half - 8}`;
      head = `${-6},${half - 9} 6,${half - 9} 0,${half}`;
      break;
    case "left":
      path = `M ${half} 0 L ${-half + 8} 0`;
      head = `${-half + 9},${-6} ${-half + 9},6 ${-half},0`;
      break;
    case "bend":
      // vertical (top) turning a corner to horizontal (left) — ALU-C down
      // onto the C bus. Straight orthogonal segments, like the MM bus wires.
      path = `M 0 ${-half} L 0 0 L ${-half + 8} 0`;
      head = `${-half + 1},${-7} ${-half + 1},7 ${-half + 8},0`;
      break;
  }

  // Open: arrowhead slides back along the path & the path retracts.
  const headShift = open ? (dir === "bend" ? 10 : 10) : 0;
  const shiftX = dir === "left" || dir === "bend" ? headShift : 0;
  const shiftY = dir === "up" ? headShift : dir === "down" ? -headShift : 0;

  return (
    <g transform={`translate(${x},${y})`} data-component="switch" data-dir={dir} data-open={open}>
      <g
        role="switch"
        aria-checked={!open}
        aria-label={label ?? `${dir} switch`}
        aria-disabled={!enabled}
        tabIndex={enabled ? 0 : -1}
        onClick={() => enabled && onChange!(!open)}
        onKeyDown={(e) => {
          if (enabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onChange!(!open);
          }
        }}
        style={{
          cursor: enabled ? "pointer" : "default",
          filter: energized ? "drop-shadow(0 0 4px var(--accent-bus))" : undefined,
          outline: "none",
        }}
      >
        {/* invisible hit area */}
        <rect x={-half - 8} y={-half - 8} width={L + 16} height={L + 16} fill="transparent" />
        <motion.path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: open ? 0.55 : 1, opacity: open ? 0.55 : 1 }}
          transition={SPRING}
        />
        <motion.polygon
          points={head}
          fill={color}
          initial={false}
          animate={{ x: shiftX, y: shiftY, opacity: open ? 0.45 : 1 }}
          transition={SPRING}
        />
      </g>
      {label && (
        <text
          x={
            dir === "bend" || dir === "left"
              ? -half - 4
              : labelSide === "left"
                ? -12
                : dir === "down"
                  ? 12
                  : 0
          }
          y={dir === "up" ? (labelSide === "left" ? 4 : half + 16) : dir === "down" ? 4 : half + 4}
          textAnchor={
            dir === "bend" || dir === "left" || labelSide === "left" ? "end" : dir === "down" ? "start" : "middle"
          }
          fill="var(--text-faint)"
          fontSize={9.5}
          letterSpacing={1}
          style={{ fontFamily: "var(--font-sans)", textTransform: "uppercase" }}
        >
          {label}
        </text>
      )}
    </g>
  );
}
