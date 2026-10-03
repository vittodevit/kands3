import { useEffect, useRef, useState } from "react";
import { reducedMotionPreferred } from "@/anim/tokens";

/**
 * 4-position rotary knob (remake of sregDial0-3.gif / saluDial0-3.gif).
 * The pointer rotates to the position with a spring; click advances,
 * wheel + arrow keys also turn it. Positions are labeled (R0-R3 / ops).
 */
export type KnobProps = {
  position: 0 | 1 | 2 | 3;
  /** Caption above the knob, e.g. "A BUS ADDRESS". */
  label: string;
  /** Per-position labels shown below, e.g. ["R0","R1","R2","R3"] or op names. */
  positions?: readonly string[];
  /** Center coordinates in the parent SVG. */
  x?: number;
  y?: number;
  size?: number;
  energized?: boolean;
  disabled?: boolean;
  onChange?: (position: 0 | 1 | 2 | 3) => void;
};

/** Position p → pointer angle in degrees (0 = up, clockwise). */
const angleFor = (p: number): number => -135 + p * 90;

/**
 * Critically-damped-ish spring driving the needle angle. The rotation is
 * applied as an SVG `rotate(a)` transform, which pivots exactly around the
 * group's local origin (0,0) = the dial center — one end of the needle —
 * unlike CSS transform-origin, which resolves against the element's bbox.
 * Angle changes always take the shortest arc.
 */
function useNeedleAngle(target: number): number {
  const [angle, setAngle] = useState(target);
  const anim = useRef({ value: target, velocity: 0, raf: 0 });

  useEffect(() => {
    const state = anim.current;
    if (reducedMotionPreferred()) {
      state.value = target;
      state.velocity = 0;
      setAngle(target);
      return;
    }
    // shortest-path delta (e.g. -135° → +135° turns 90°, not 270°)
    let delta = (target - state.value) % 360;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const settled = state.value + delta;

    const stiffness = 170;
    const damping = 22;
    let last = performance.now();
    let idleTicks = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const force = (settled - state.value) * stiffness - state.velocity * damping;
      state.velocity += force * dt;
      state.value += state.velocity * dt;
      if (Math.abs(settled - state.value) < 0.05 && Math.abs(state.velocity) < 0.05) {
        state.value = settled;
        state.velocity = 0;
        setAngle(settled);
        state.raf = 0;
        return; // settled
      }
      setAngle(state.value);
      if (++idleTicks < 600) state.raf = requestAnimationFrame(tick);
      else {
        state.value = settled;
        setAngle(settled);
        state.raf = 0;
      }
    };
    state.raf = requestAnimationFrame(tick);
    return () => {
      if (state.raf) cancelAnimationFrame(state.raf);
      state.raf = 0;
    };
  }, [target]);

  return angle;
}

export function Knob({
  position,
  label,
  positions,
  x = 0,
  y = 0,
  size = 56,
  energized = false,
  disabled = false,
  onChange,
}: KnobProps) {
  const r = size / 2;
  const needle = useNeedleAngle(angleFor(position));
  const enabled = !disabled && !!onChange;
  const groupRef = useRef<SVGGElement | null>(null);

  // Non-passive wheel listener so we can preventDefault page scroll.
  useEffect(() => {
    const el = groupRef.current;
    if (!el || !enabled) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      onChange!((position + (e.deltaY > 0 || e.deltaX > 0 ? 1 : 3)) % 4 as 0 | 1 | 2 | 3);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [enabled, onChange, position]);

  const advance = (dir: 1 | -1) => {
    if (!enabled) return;
    onChange!((position + dir + 4) % 4 as 0 | 1 | 2 | 3);
  };

  const stroke = energized ? "var(--accent-bus)" : "var(--border-strong)";
  const pointer = energized ? "var(--accent-bus)" : "var(--text-muted)";

  return (
    <g transform={`translate(${x},${y})`} data-component="knob" data-position={position}>
      {/* caption */}
      <text
        y={-r - 22}
        textAnchor="middle"
        fill="var(--text-faint)"
        fontSize={10}
        letterSpacing={1.5}
        style={{ fontFamily: "var(--font-sans)", textTransform: "uppercase" }}
      >
        {label}
      </text>

      <g
        ref={groupRef}
        role="slider"
        tabIndex={enabled ? 0 : -1}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={position}
        aria-valuetext={positions?.[position]}
        aria-disabled={!enabled}
        onClick={() => advance(1)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            advance(1);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            advance(-1);
          } else if (e.key === "Home") {
            e.preventDefault();
            if (enabled) onChange!(0);
          } else if (e.key === "End") {
            e.preventDefault();
            if (enabled) onChange!(3);
          }
        }}
        style={{
          cursor: enabled ? "pointer" : "default",
          filter: energized ? "drop-shadow(0 0 4px var(--accent-bus))" : undefined,
          outline: "none",
        }}
      >
        {/* energized ring */}
        {energized && <circle r={r + 5} fill="none" stroke="var(--accent-bus)" strokeWidth={1.5} opacity={0.6} />}
        {/* body */}
        <circle r={r} fill="var(--surface-raised)" stroke={stroke} strokeWidth={energized ? 2 : 1.5} />
        <circle r={r - 4} fill="var(--surface-sunken)" opacity={0.55} />

        {/* tick marks at the four positions */}
        {[0, 1, 2, 3].map((p) => {
          const a = ((angleFor(p) - 90) * Math.PI) / 180;
          const on = p === position;
          return (
            <line
              key={p}
              x1={Math.cos(a) * (r + 3)}
              y1={Math.sin(a) * (r + 3)}
              x2={Math.cos(a) * (r + 8)}
              y2={Math.sin(a) * (r + 8)}
              stroke={on ? "var(--accent-bus)" : "var(--border-strong)"}
              strokeWidth={on ? 2 : 1.25}
              strokeLinecap="round"
            />
          );
        })}

        {/* rotating needle — pivots at (0,0), the dial center */}
        <g transform={`rotate(${needle})`}>
          <line x1={0} y1={4} x2={0} y2={-(r - 7)} stroke={pointer} strokeWidth={3} strokeLinecap="round" />
          <circle cy={-(r - 7)} r={2.2} fill={pointer} />
        </g>
        <circle r={2.6} fill="var(--border-strong)" />
      </g>

      {/* position label */}
      <text
        y={r + 20}
        textAnchor="middle"
        fill={energized ? "var(--accent-bus)" : "var(--text-muted)"}
        fontSize={12}
        fontWeight={600}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {positions ? (positions[position] ?? String(position)) : String(position)}
      </text>
    </g>
  );
}
