import { useEffect, useMemo } from "react";
import { ChevronFirst, ChevronLast, Pause, Play, Square, Trash2 } from "lucide-react";
import { Button } from "@/ui/primitives";
import { AluBox, BusWire, Knob, LatchBox, RegisterBox, SwitchArrow, ValueTag } from "@/ui/machine";
import { ALU_OP_NAMES } from "@/ui/machine";
import { useSession, shownState, type RunKind } from "@/state/sessionStore";
import { useSettings } from "@/state/settingsStore";
import { reducedMotionPreferred } from "@/anim/tokens";
import type { ActorId } from "@/core/types";
import { cn } from "@/lib/utils";

/**
 * DatapathStage (REMAKE-PLAN §6.1) — the always-on machine scene: register
 * file R0-R3, A/B/C buses, ALU latches + ALU (op knob, flag chips), knobs,
 * and (when the memory feature is on) the bend/toMemory/fromMemory switches
 * and the MM-bus stub. One responsive SVG composition. Wires/atoms energize
 * from `sessionStore.activeStep.actors` ("wire:a-bus", "reg:R2",
 * "latch:aluA", "switch:bend", …). Interactions are disabled while running;
 * every edit goes through sessionStore.setMachine (which clears the run).
 */

/* ── Scene geometry (viewBox 1040×700) ─────────────────────────────── */

const VB_W = 1040;
const VB_H = 700;

const BANK = { x: 250, y: 16, w: 470, h: 196 };
const ROW_Y = (i: number) => 50 + i * 38;

const KNOB = { C: { x: 150, y: 128 }, A: { x: 800, y: 110 }, B: { x: 945, y: 110 }, ALU: { x: 985, y: 545 } };

const ALU = { x: 650, y: 470, w: 280, h: 120 };
const LATCH = {
  A: { x: 612, y: 390, w: 166, h: 44 },
  B: { x: 797, y: 390, w: 166, h: 44 },
  C: { x: 475, y: 508, w: 166, h: 44 },
};

const WIRES = {
  aBus: "M 330 212 V 260 H 695 V 390",
  bBus: "M 430 212 V 300 H 880 V 390",
  aLatchIn: "M 695 434 V 470",
  bLatchIn: "M 880 434 V 470",
  aluCOut: "M 650 530 H 643",
  aluCDrop: "M 557 552 V 586",
  cBusNoMem: "M 300 612 H 531",
  cBusMem: "M 300 612 H 700",
  cWrite: "M 300 612 V 273",
  mmBus: "M 540 668 H 760",
};

/* ── Component ─────────────────────────────────────────────────────── */

export function DatapathStage() {
  const machine = useSession((s) => shownState(s));
  const status = useSession((s) => s.status);
  const cursor = useSession((s) => s.cursor);
  const hasTimeline = useSession((s) => s.timeline.length > 0);
  const activeStep = useSession((s) => s.activeStep);
  const run = useSession((s) => s.run);
  const continueRun = useSession((s) => s.continueRun);
  const pause = useSession((s) => s.pause);
  const resume = useSession((s) => s.resume);
  const halt = useSession((s) => s.halt);
  const stepForward = useSession((s) => s.stepForward);
  const stepBack = useSession((s) => s.stepBack);
  const clearRun = useSession((s) => s.clearRun);
  const commitShownToBase = useSession((s) => s.commitShownToBase);
  const turnKnob = useSession((s) => s.turnKnob);
  const toggleSwitch = useSession((s) => s.toggleSwitch);
  const setReg = useSession((s) => s.setReg);

  const features = useSettings((s) => s.features);
  const base = useSettings((s) => s.base);
  const speed = useSettings((s) => s.speed);

  const running = status === "running";
  const actors = useMemo(() => new Set<string>(activeStep?.actors ?? [] as ActorId[]), [activeStep]);
  const has = (id: string) => actors.has(id);
  const hotFlags = useMemo(
    () => new Set((activeStep?.actors ?? []).filter((a) => a.startsWith("flag:"))),
    [activeStep],
  );
  const particles = (on: boolean) => on && speed !== "instant" && !reducedMotionPreferred();

  const runKind: RunKind = features.control ? "instruction" : features.microprog ? "micro" : "datapath";
  const runLabel = features.control ? "Run instruction" : features.microprog ? "Run microprogram" : "Run pass";

  // ⌘Z / ⇧⌘Z (undo/redo = step back/forward through the timeline).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      if (e.shiftKey) stepForward();
      else stepBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepBack, stepForward]);

  const onStep = () => {
    const s = useSession.getState();
    if (s.timeline.length === 0) {
      s.run(runKind);
      s.halt(); // build the timeline but stay in edit/step mode
    }
    useSession.getState().stepForward();
  };

  const regSelection = (i: number) =>
    (machine.knobs.AAddr === i ? "A" : "") + (machine.knobs.BAddr === i ? "B" : "");

  return (
    <section
      aria-label="Datapath"
      className="flex min-h-0 flex-1 flex-col gap-3"
      data-stage="datapath"
      data-status={status}
    >
      {/* ── Playback controls ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-raised">
        <Button
          size="sm"
          variant="primary"
          disabled={running}
          onClick={() => {
            // Halted shown state → fresh restart; otherwise append so the
            // run history accumulates across instructions/passes.
            if (shownState(useSession.getState()).halted) run(runKind);
            else continueRun(runKind);
          }}
        >
          <Play aria-hidden className="h-3.5 w-3.5" />
          {runLabel}
        </Button>
        <Button size="sm" disabled={running} onClick={onStep}>
          <ChevronLast aria-hidden className="h-3.5 w-3.5" />
          Step
        </Button>
        <Button size="sm" disabled={running || cursor === 0} onClick={() => stepBack()}>
          <ChevronFirst aria-hidden className="h-3.5 w-3.5" />
          Back
        </Button>
        {running ? (
          <Button size="sm" onClick={() => pause()}>
            <Pause aria-hidden className="h-3.5 w-3.5" />
            Pause
          </Button>
        ) : status === "paused" ? (
          <Button size="sm" variant="primary" onClick={() => resume()}>
            <Play aria-hidden className="h-3.5 w-3.5" />
            Resume
          </Button>
        ) : null}
        {(running || status === "paused") && (
          <Button size="sm" onClick={() => halt()}>
            <Square aria-hidden className="h-3.5 w-3.5" />
            Halt
          </Button>
        )}
        {activeStep !== null && hasTimeline && (
          <>
            <Button size="sm" variant="ghost" onClick={() => commitShownToBase()}>
              <Trash2 aria-hidden className="h-3.5 w-3.5" />
              Apply shown state
            </Button>
            <Button size="sm" variant="ghost" onClick={() => clearRun()}>
              Clear run
            </Button>
          </>
        )}
        <span
          className={cn(
            "machine-nums ml-auto rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wider",
            status === "running" && "border-accent-bus/50 bg-accent-bus-soft text-accent-bus",
            status === "halted" && "border-accent-danger/50 bg-accent-danger-soft text-accent-danger",
            (status === "idle" || status === "paused" || status === "done") && "border-line text-ink-faint",
          )}
          role="status"
        >
          {status}
        </span>
      </div>

      {/* Narration line (also a live region; the dock panel repeats it) */}
      <p
        aria-live="polite"
        className={cn(
          "min-h-5 text-xs leading-relaxed",
          activeStep ? "text-ink-muted" : "text-ink-faint",
        )}
        data-narration={activeStep?.kind ?? "none"}
      >
        {activeStep?.narration ?? "Set the knobs and switches, then Run — each step narrates here."}
      </p>

      {/* ── The machine scene ─────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 items-start justify-center pt-1">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          role="img"
          aria-label="Knob and Switch Computer datapath"
          preserveAspectRatio="xMidYMid meet"
          className="h-auto max-h-full w-full min-w-0 max-w-[1180px] select-none"
        >
        {/* Register bank frame */}
        <rect
          x={BANK.x}
          y={BANK.y}
          width={BANK.w}
          height={BANK.h}
          rx={10}
          fill="var(--surface-sunken)"
          fillOpacity={0.45}
          stroke="var(--border)"
        />
        <text
          x={BANK.x + BANK.w / 2}
          y={BANK.y + 20}
          textAnchor="middle"
          fill="var(--text-faint)"
          fontSize={10}
          letterSpacing={2.5}
          style={{ fontFamily: "var(--font-sans)" }}
        >
          REGISTER BANK
        </text>

        {/* Registers */}
        {[0, 1, 2, 3].map((i) => {
          const energized = has(`reg:R${i}`);
          const writePulse = activeStep?.kind === "regWrite" && energized;
          return (
            <g key={i}>
              <RegisterBox
                label={`R${i}`}
                value={machine.regs[i] ?? 0}
                base={base}
                x={BANK.x + 16}
                y={ROW_Y(i)}
                width={BANK.w - 32}
                height={32}
                energized={energized && !writePulse}
                writePulse={writePulse}
                editable={!running}
                onWrite={(w) => setReg(i as 0 | 1 | 2 | 3, w)}
              />
              {/* read-selection markers (A/B address knobs, C write target) */}
              {regSelection(i) && (
                <text
                  x={BANK.x + BANK.w + 10}
                  y={ROW_Y(i) + 21}
                  fill="var(--accent-bus)"
                  fontSize={10}
                  fontWeight={700}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {regSelection(i)}
                </text>
              )}
              {machine.knobs.CAddr === i && (
                <text
                  x={BANK.x - 10}
                  y={ROW_Y(i) + 21}
                  textAnchor="end"
                  fill="var(--accent-memory)"
                  fontSize={10}
                  fontWeight={700}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  C
                </text>
              )}
            </g>
          );
        })}

        {/* Address knobs */}
        <Knob
          label="C bus address"
          positions={["R0", "R1", "R2", "R3"]}
          position={machine.knobs.CAddr}
          x={KNOB.C.x}
          y={KNOB.C.y}
          energized={has("knob:CAddr")}
          disabled={running}
          onChange={(p) => turnKnob("CAddr", p)}
        />
        <Knob
          label="A bus address"
          positions={["R0", "R1", "R2", "R3"]}
          position={machine.knobs.AAddr}
          x={KNOB.A.x}
          y={KNOB.A.y}
          energized={has("knob:AAddr")}
          disabled={running}
          onChange={(p) => turnKnob("AAddr", p)}
        />
        <Knob
          label="B bus address"
          positions={["R0", "R1", "R2", "R3"]}
          position={machine.knobs.BAddr}
          x={KNOB.B.x}
          y={KNOB.B.y}
          energized={has("knob:BAddr")}
          disabled={running}
          onChange={(p) => turnKnob("BAddr", p)}
        />

        {/* A / B buses */}
        <BusWire id="wire:a-bus" d={WIRES.aBus} energized={has("wire:a-bus")} particles={particles(has("wire:a-bus"))} />
        <BusWire id="wire:b-bus" d={WIRES.bBus} energized={has("wire:b-bus")} particles={particles(has("wire:b-bus"))} />
        <ValueTag label="A" value={machine.aBus} base={base} x={480} y={238} energized={has("wire:a-bus")} />
        <ValueTag label="B" value={machine.bBus} base={base} x={610} y={280} energized={has("wire:b-bus")} />

        {/* ALU input latches */}
        <BusWire id="wire:a-latch" d={WIRES.aLatchIn} energized={has("latch:aluA")} particles={particles(has("latch:aluA"))} />
        <BusWire id="wire:b-latch" d={WIRES.bLatchIn} energized={has("latch:aluB")} particles={particles(has("latch:aluB"))} />
        <LatchBox
          label="ALU A"
          value={machine.aluA}
          base={base}
          x={LATCH.A.x}
          y={LATCH.A.y}
          width={LATCH.A.w}
          height={LATCH.A.h}
          energized={has("latch:aluA")}
        />
        <LatchBox
          label="ALU B"
          value={machine.aluB}
          base={base}
          x={LATCH.B.x}
          y={LATCH.B.y}
          width={LATCH.B.w}
          height={LATCH.B.h}
          energized={has("latch:aluB")}
        />

        {/* ALU + op knob */}
        <AluBox
          op={machine.knobs.ALU}
          flags={machine.flags}
          x={ALU.x}
          y={ALU.y}
          width={ALU.w}
          height={ALU.h}
          energized={has("knob:ALU") || has("latch:aluC")}
          hotFlags={hotFlags}
        />
        <Knob
          label="ALU op"
          positions={ALU_OP_NAMES}
          position={machine.knobs.ALU}
          x={KNOB.ALU.x}
          y={KNOB.ALU.y}
          energized={has("knob:ALU")}
          disabled={running}
          onChange={(p) => turnKnob("ALU", p)}
        />

        {/* ALU C latch + drop to the C bus */}
        <BusWire id="wire:aluC-out" d={WIRES.aluCOut} energized={has("latch:aluC")} particles={particles(has("latch:aluC"))} />
        <LatchBox label="ALU C" value={machine.aluC} base={base} x={LATCH.C.x} y={LATCH.C.y} width={LATCH.C.w} height={LATCH.C.h} energized={has("latch:aluC")} />

        {/* bend: straight vertical drop from the ALU C latch into the C bus */}
        <SwitchArrow
          dir="down"
          open={features.memory ? !machine.switches.bend : false}
          x={LATCH.C.x + LATCH.C.w / 2}
          y={582}
          length={58}
          label="bend · ALU-C → C bus"
          labelSide="left"
          energized={has("switch:bend") || (!features.memory && has("latch:aluC"))}
          disabled={running || !features.memory}
          onChange={() => toggleSwitch("bend")}
        />

        {/* C bus + write-back to the register bank */}
        <BusWire
          id="wire:c-bus"
          d={features.memory ? WIRES.cBusMem : WIRES.cBusNoMem}
          energized={has("wire:c-bus")}
          particles={particles(has("wire:c-bus"))}
        />
        <ValueTag label="C" value={machine.cBus} base={base} x={312} y={431} energized={has("wire:c-bus")} />
        <BusWire
          id="wire:c-write"
          d={WIRES.cWrite}
          energized={has("switch:CArrow") || has("wire:c-bus")}
          particles={particles(has("switch:CArrow"))}
        />
        <SwitchArrow
          dir="up"
          open={features.memory ? !machine.switches.CArrow : false}
          x={300}
          y={245}
          length={56}
          label="to registers"
          labelSide="left"
          energized={has("switch:CArrow")}
          disabled={running || !features.memory}
          onChange={() => toggleSwitch("CArrow")}
        />

        {/* Memory switches + MM bus (only when the memory feature is on) */}
        {features.memory && (
          <>
            <SwitchArrow
              dir="down"
              open={!machine.switches.toMemory}
              x={600}
              y={640}
              length={44}
              label="to mem"
              energized={has("switch:toMemory")}
              disabled={running}
              onChange={() => toggleSwitch("toMemory")}
            />
            <SwitchArrow
              dir="up"
              open={!machine.switches.fromMemory}
              x={690}
              y={640}
              length={44}
              label="from mem"
              energized={has("switch:fromMemory")}
              disabled={running}
              onChange={() => toggleSwitch("fromMemory")}
            />
            <BusWire
              id="wire:mm-bus"
              d={WIRES.mmBus}
              energized={has("wire:mm-bus")}
              particles={particles(has("wire:mm-bus"))}
              energizedColor="var(--accent-memory)"
            />
            <ValueTag
              label="MM"
              value={machine.mmBus}
              base={base}
              x={775}
              y={657}
              energized={has("wire:mm-bus")}
              energizedColor="var(--accent-memory)"
            />
            <text
              x={700}
              y={694}
              textAnchor="end"
              fill="var(--text-faint)"
              fontSize={10}
              letterSpacing={1}
              style={{ fontFamily: "var(--font-sans)" }}
            >
              MAIN MEMORY BUS · MEMORY STAGE →
            </text>
          </>
        )}
        </svg>
      </div>
    </section>
  );
}
