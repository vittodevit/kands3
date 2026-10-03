import { beforeEach, describe, expect, it } from "vitest";
import { assemble } from "@/core/assembler";
import { createMachine } from "@/core/machine";
import { shownState, useSession } from "@/state/sessionStore";
import { useSettings } from "@/state/settingsStore";

/**
 * continueRun — full-run history in full-machine mode: instruction cycles
 * are APPENDED to the timeline (comprehensive breakdown), halted machines
 * refuse to continue, and edits still clear the history.
 */

/** LOAD R0 5 / ADD R0 R0 R0 / STORE 6 R0 / HALT (data 7 at addr 5). */
const PROGRAM = [
  assemble("LOAD R0 5")!,
  assemble("ADD R0 R0 R0")!,
  assemble("STORE 6 R0")!,
  assemble("HALT")!,
];

function reset(full = true) {
  useSettings.setState({
    features: { memory: full, microprog: full, control: full },
  });
  const machine = createMachine(useSettings.getState().features);
  machine.memory = [...PROGRAM, ...machine.memory.slice(PROGRAM.length)];
  machine.memory[5] = 7; // data word for LOAD R0 5
  useSession.setState({ machine, timeline: [], cursor: 0, status: "idle", activeStep: null });
}

beforeEach(() => reset());

describe("continueRun", () => {
  it("appends the next instruction cycle instead of replacing the timeline", () => {
    useSession.getState().run("instruction");
    const first = useSession.getState().timeline.slice();
    expect(first.length).toBeGreaterThan(0);
    expect(useSession.getState().status).toBe("running");

    // play to the end of the first cycle
    useSession.getState().scrubTo(first.length);
    expect(useSession.getState().status).toBe("done");

    useSession.getState().continueRun("instruction");
    const s = useSession.getState();
    expect(s.timeline.length).toBeGreaterThan(first.length);
    // earlier history preserved verbatim
    expect(s.timeline.slice(0, first.length)).toEqual(first);
    expect(s.status).toBe("running");
  });

  it("keeps the cursor-0 base so scrubbing to 0 still shows the run's start", () => {
    const baseBefore = useSession.getState().machine;
    useSession.getState().run("instruction");
    useSession.getState().scrubTo(useSession.getState().timeline.length);
    useSession.getState().continueRun("instruction");
    expect(useSession.getState().machine).toBe(baseBefore); // untouched reference
    useSession.getState().scrubTo(0);
    // shown state at cursor 0 == the machine we started from (pc 0, ir null)
    expect(shownState(useSession.getState()).pc).toBe(0);
    expect(shownState(useSession.getState()).ir).toBeNull();
  });

  it("accumulates the WHOLE program run: executes to HALT with all steps in one timeline", () => {
    const { run, continueRun, scrubTo } = useSession.getState();
    run("instruction");
    for (let i = 0; i < 10 && useSession.getState().status !== "halted"; i++) {
      scrubTo(useSession.getState().timeline.length);
      if (useSession.getState().status === "done") continueRun("instruction");
    }
    const s = useSession.getState();
    expect(s.status).toBe("halted");
    // 3 real instructions + HALT: at least 4 fetch steps in ONE timeline.
    const fetches = s.timeline.filter((st) => st.kind === "fetch");
    expect(fetches.length).toBeGreaterThanOrEqual(4);
    // final state: R0 = 14 (7+7), memory[6] = 14
    const end = s.timeline[s.timeline.length - 1]!.state;
    expect(end.regs[0]).toBe(14);
    expect(end.memory[6]).toBe(14);
    expect(end.halted).toBe(true);
  });

  it("refuses to continue a halted machine", () => {
    const { run, scrubTo, continueRun } = useSession.getState();
    run("instruction");
    // run everything to halt
    for (let i = 0; i < 10; i++) {
      scrubTo(useSession.getState().timeline.length);
      if (useSession.getState().status !== "done") break;
      continueRun("instruction");
    }
    const len = useSession.getState().timeline.length;
    expect(useSession.getState().status).toBe("halted");
    useSession.getState().continueRun("instruction");
    expect(useSession.getState().timeline.length).toBe(len); // unchanged
  });

  it("no-ops while running and delegates to run() on an empty timeline", () => {
    useSession.getState().continueRun("instruction"); // empty → run
    expect(useSession.getState().timeline.length).toBeGreaterThan(0);
    expect(useSession.getState().status).toBe("running");
    const len = useSession.getState().timeline.length;
    useSession.getState().continueRun("instruction"); // running → no-op
    expect(useSession.getState().timeline.length).toBe(len);
  });

  it("jumping a scrubbed-back playhead to the end before appending", () => {
    useSession.getState().run("instruction");
    const len1 = useSession.getState().timeline.length;
    useSession.getState().scrubTo(1); // scrub back into history
    expect(useSession.getState().status).toBe("paused");
    useSession.getState().continueRun("instruction");
    const s = useSession.getState();
    expect(s.cursor).toBe(len1); // playhead moved to the segment boundary
    expect(s.timeline.length).toBeGreaterThan(len1);
  });

  it("edits still clear the accumulated history", () => {
    useSession.getState().run("instruction");
    useSession.getState().scrubTo(useSession.getState().timeline.length);
    useSession.getState().continueRun("instruction");
    expect(useSession.getState().timeline.length).toBeGreaterThan(0);
    useSession.getState().setMachine({ pc: 0 });
    expect(useSession.getState().timeline).toHaveLength(0);
    expect(useSession.getState().status).toBe("idle");
  });
});
