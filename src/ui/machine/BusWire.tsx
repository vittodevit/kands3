/**
 * Orthogonal bus wire: rounded-join polyline rendered from a path string.
 * Rest state is the neutral wire color; when energized, an accent overlay
 * flows (animated dash offset) and — if `particles` — 3 small circles travel
 * along the path via SVG <animateMotion> (REMAKE-PLAN §2 dataflow look).
 */
export type BusWireProps = {
  id: string;
  d: string;
  energized?: boolean;
  /** Flowing particle circles (stage gates this on speed/reduced-motion). */
  particles?: boolean;
  /** Override the rest color (e.g. memory traffic green). */
  restColor?: string;
  /** Override the energized color (e.g. var(--accent-memory)). */
  energizedColor?: string;
};

const PARTICLE_COUNT = 3;
const FLOW_PERIOD_S = 1.1;

export function BusWire({
  id,
  d,
  energized = false,
  particles = false,
  restColor = "var(--accent-rest)",
  energizedColor = "var(--accent-bus)",
}: BusWireProps) {
  return (
    <g data-component="bus-wire" data-id={id} data-energized={energized}>
      <path
        id={id}
        d={d}
        fill="none"
        stroke={restColor}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {energized && (
        <>
          <path
            d={d}
            fill="none"
            stroke={energizedColor}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray="10 6"
            opacity={0.9}
            style={{ filter: "drop-shadow(0 0 3px var(--accent-bus))" }}
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="-32"
              dur={`${FLOW_PERIOD_S}s`}
              repeatCount="indefinite"
            />
          </path>
          {particles &&
            Array.from({ length: PARTICLE_COUNT }, (_, i) => (
              <circle key={i} r={3} fill={energizedColor} opacity={0.95}>
                <animateMotion
                  dur={`${FLOW_PERIOD_S}s`}
                  begin={`${(i * FLOW_PERIOD_S) / PARTICLE_COUNT}s`}
                  repeatCount="indefinite"
                  path={d}
                />
              </circle>
            ))}
        </>
      )}
    </g>
  );
}
