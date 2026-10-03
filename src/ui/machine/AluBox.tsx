import type { AluOp, Flags } from "@/core/types";
import { Tooltip } from "@/ui/primitives";
import { useT } from "@/i18n/useT";

/**
 * ALU with the classic notched-trapezoid silhouette, current op label, and
 * the four flag chips that latch and stay until the next ALU op (zero,
 * negative, unsigned/signed overflow). `hotFlags` carries actor ids
 * ("flag:zero", …) from the active timeline step.
 */
export type AluBoxProps = {
  op: AluOp;
  flags: Flags | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  energized?: boolean;
  hotFlags?: ReadonlySet<string>;
};

export const ALU_OP_NAMES: readonly string[] = ["ADD", "OR", "AND", "SUB"];

const FLAG_CHIPS: readonly { key: keyof Flags; actor: string; short: string }[] = [
  { key: "zero", actor: "flag:zero", short: "Z" },
  { key: "negative", actor: "flag:negative", short: "N" },
  { key: "unsignedOverflow", actor: "flag:unsignedOverflow", short: "UOV" },
  { key: "signedOverflow", actor: "flag:signedOverflow", short: "SOV" },
];
export function AluBox({
  op,
  flags,
  x = 0,
  y = 0,
  width = 280,
  height = 120,
  energized = false,
  hotFlags,
}: AluBoxProps) {
  const t = useT();
  const stroke = energized ? "var(--accent-bus)" : "var(--border-strong)";
  // Notched top edge: two input ledges feeding the body.
  const notchL = width * 0.22;
  const notchR = width * 0.78;
  const notchDepth = 18;
  const shape = `M0 0 H${notchL} V${notchDepth} H${notchR} V0 H${width} V${height} H0 Z`;

  const chipY = height - 30;
  const chipW = 52;
  const chipGap = 10;
  const chipsW = FLAG_CHIPS.length * chipW + (FLAG_CHIPS.length - 1) * chipGap;
  const chipsX0 = (width - chipsW) / 2;

  return (
    <g transform={`translate(${x},${y})`} data-component="alu" data-op={op}>
      <path
        d={shape}
        fill="var(--surface)"
        stroke={stroke}
        strokeWidth={energized ? 2 : 1.5}
        strokeLinejoin="round"
        style={{ filter: energized ? "drop-shadow(0 0 5px var(--accent-bus))" : undefined }}
      />
      <text
        x={width / 2}
        y={notchDepth + (height - notchDepth) / 2 - 14}
        textAnchor="middle"
        fill="var(--text-faint)"
        fontSize={9.5}
        letterSpacing={2}
        style={{ fontFamily: "var(--font-sans)" }}
      >
        ALU
      </text>
      <text
        x={width / 2}
        y={notchDepth + (height - notchDepth) / 2 + 4}
        textAnchor="middle"
        fill={energized ? "var(--accent-bus)" : "var(--text)"}
        fontSize={17}
        fontWeight={700}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {ALU_OP_NAMES[op]}
      </text>

      {/* flag chips — latch (stay on) once set; hot while their actor fires */}
      {FLAG_CHIPS.map((f, i) => {
        const set = flags?.[f.key] ?? false;
        const hot = hotFlags?.has(f.actor) ?? false;
        const cx = chipsX0 + i * (chipW + chipGap);
        return (
          <g key={f.key} transform={`translate(${cx},${chipY})`} data-flag={f.key} data-set={set}>
            <rect
              width={chipW}
              height={22}
              rx={5}
              fill={set ? "var(--accent-bus-soft)" : "var(--surface-sunken)"}
              stroke={hot ? "var(--accent-bus)" : set ? "var(--accent-bus)" : "var(--border)"}
              strokeWidth={hot ? 2 : 1.2}
              opacity={flags ? 1 : 0.55}
              style={hot ? { filter: "drop-shadow(0 0 4px var(--accent-bus))" } : undefined}
            />
            <text
              x={chipW / 2}
              y={15}
              textAnchor="middle"
              fill={set ? "var(--accent-bus)" : "var(--text-faint)"}
              fontSize={10.5}
              fontWeight={600}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {f.short}
            </text>
            {/* Tooltip hotspot over the chip (HTML island in the SVG scene) */}
            <foreignObject width={chipW} height={22} style={{ overflow: "visible" }}>
              <Tooltip
                content={
                  <span>
                    <b>{t(`alu.flag.${f.key}`)}</b>
                    <br />
                    {flags
                      ? set
                        ? t("alu.flag.stateSet")
                        : t("alu.flag.stateClear")
                      : t("alu.flag.stateNone")}
                  </span>
                }
              >
                <div style={{ width: chipW, height: 22, cursor: "help" }} />
              </Tooltip>
            </foreignObject>
          </g>
        );
      })}
    </g>
  );
}
