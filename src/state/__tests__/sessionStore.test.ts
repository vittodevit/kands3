/**
 * Session store behavior tests (CONTRACT Addendum v2): run/pause/tick/scrub/
 * stepBack/clearRun/edit-clears-timeline, and the shown-state derivation.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useSession, shownState } from "@/state/sessionStore";
import { useSettings, PRESET_FEATURES } from "@/state/settingsStore";
import { createMachine } from "@/core/machine";
import { toBits } from "@/core/numbers";

function reset(features = PRESET_FEATURES.datapath) {
  useSettings.setState({ features });
  useSession.setState({
    machine: createMachine(features),
    timeline: [],
    cursor: 0,
    status: "idle",
    activeStep: null,
  });
}

beforeEach(() => reset());

describe("initial state", () => {
  it("starts idle with an empty timeline and shown == machine", () => {
    const s = useSession.getState();
    expect(s.status).toBe("idle");
    expect(s.timeline).toHaveLength(0);
    expect(s.cursor).toBe(0);
    expect(s.activeStep).toBeNull();
    expect(shownState(s)).toBe(s.machine);
  });
});

describe("run", () => {
  it("builds a timeline from the sequencer and starts running", () => {
    useSession.getState().run("datapath");
    const s = useSession.getState();
    // datapath-only pass = 5 steps (regs→buses, latches, alu, c-bus, write)
    expect(s.timeline.length).toBe(5);
    expect(s.cursor).toBe(0);
    expect(s.status).toBe("running");
    expect(s.activeStep).toBeNull();
  });

  it("uses the CURRENT shown state as base (edits flow into the run)", () => {
    useSession.getState().setReg(0, 7); // AAddr/BAddr default to R0
    useSession.getState().run("datapath");
    const first = useSession.getState().timeline[0]!;
    expect(first.state.aBus).toBe(7);
  });

  it("rebuilding mid-timeline forks from the shown state", () => {
    useSession.getState().run("datapath");
    useSession.getState().scrubTo(2);
    useSession.getState().run("datapath");
    const s = useSession.getState();
    expect(s.cursor).toBe(0);
    expect(s.machine).toStrictEqual(s.timeline[1]!.state); // shown state became base
  });
});

describe("tick / done / halted", () => {
  it("advances the cursor and sets activeStep", () => {
    useSession.getState().run("datapath");
    useSession.getState().tick();
    const s = useSession.getState();
    expect(s.cursor).toBe(1);
    expect(s.activeStep).toBe(s.timeline[0]);
    expect(shownState(s)).toBe(s.timeline[0]!.state);
  });

  it("ends as done after the last step", () => {
    useSession.getState().run("datapath");
    for (let i = 0; i < 5; i++) useSession.getState().tick();
    const s = useSession.getState();
    expect(s.cursor).toBe(5);
    expect(s.status).toBe("done");
    expect(s.activeStep).toBe(s.timeline[4]);
  });

  it("ends as halted on a HALT instruction cycle", () => {
    reset(PRESET_FEATURES.full);
    useSession.getState().setMemoryValues([0xffff]); // HALT at address 0
    useSession.getState().run("instruction");
    const n = useSession.getState().timeline.length;
    for (let i = 0; i < n; i++) useSession.getState().tick();
    const s = useSession.getState();
    expect(s.status).toBe("halted");
    expect(shownState(s).halted).toBe(true);
  });

  it("marks memory writes as slow writes (weight 4)", () => {
    reset(PRESET_FEATURES.plusMemory);
    useSession.getState().setMachine({ switches: { CArrow: true, toMemory: true, fromMemory: false, bend: true } });
    useSession.getState().run("datapath");
    const last = useSession.getState().timeline.at(-1)!;
    expect(last.kind).toBe("memWrite");
    expect(last.weight).toBe(4);
  });
});

describe("pause / resume / halt", () => {
  it("pauses and resumes a run", () => {
    useSession.getState().run("datapath");
    useSession.getState().tick();
    useSession.getState().pause();
    expect(useSession.getState().status).toBe("paused");
    useSession.getState().resume();
    expect(useSession.getState().status).toBe("running");
    expect(useSession.getState().cursor).toBe(1); // continues from cursor
  });

  it("halt stops playback but keeps the timeline for scrubbing", () => {
    useSession.getState().run("datapath");
    useSession.getState().tick();
    useSession.getState().halt();
    const s = useSession.getState();
    expect(s.status).toBe("idle");
    expect(s.timeline.length).toBe(5);
    expect(s.cursor).toBe(1);
  });
});

describe("step / scrub", () => {
  it("stepForward advances and pauses a running playback", () => {
    useSession.getState().run("datapath");
    useSession.getState().stepForward();
    const s = useSession.getState();
    expect(s.cursor).toBe(1);
    expect(s.status).toBe("paused");
  });

  it("stepForward marks done at the end", () => {
    useSession.getState().run("datapath");
    useSession.getState().halt();
    for (let i = 0; i < 5; i++) useSession.getState().stepForward();
    expect(useSession.getState().status).toBe("done");
    expect(useSession.getState().stepForward()); // no-op at end
    expect(useSession.getState().cursor).toBe(5);
  });

  it("stepBack is the ⌘Z primitive and floors at 0", () => {
    useSession.getState().run("datapath");
    useSession.getState().halt();
    useSession.getState().stepForward();
    useSession.getState().stepForward();
    useSession.getState().stepBack();
    expect(useSession.getState().cursor).toBe(1);
    useSession.getState().stepBack();
    useSession.getState().stepBack();
    expect(useSession.getState().cursor).toBe(0);
  });

  it("scrubTo moves the cursor and pauses", () => {
    useSession.getState().run("datapath");
    useSession.getState().scrubTo(3);
    const s = useSession.getState();
    expect(s.cursor).toBe(3);
    expect(s.status).toBe("paused");
    expect(shownState(s)).toBe(s.timeline[2]!.state);
    expect(s.activeStep).toBe(s.timeline[2]);
  });

  it("scrubTo clamps out-of-range indices", () => {
    useSession.getState().run("datapath");
    useSession.getState().scrubTo(99);
    expect(useSession.getState().cursor).toBe(5);
    expect(useSession.getState().status).toBe("done");
  });
});

describe("edits clear the timeline (edit mode)", () => {
  it("setMachine clears the run and patches the base machine", () => {
    useSession.getState().run("datapath");
    useSession.getState().tick();
    useSession.getState().setMachine({ cBus: 9 });
    const s = useSession.getState();
    expect(s.timeline).toHaveLength(0);
    expect(s.cursor).toBe(0);
    expect(s.status).toBe("idle");
    expect(s.activeStep).toBeNull();
    expect(s.machine.cBus).toBe(9);
  });

  it("turnKnob / toggleSwitch / setReg / setMemoryValues all go through setMachine", () => {
    useSession.getState().run("datapath");
    useSession.getState().turnKnob("AAddr", 2);
    expect(useSession.getState().machine.knobs.AAddr).toBe(2);
    expect(useSession.getState().timeline).toHaveLength(0);

    useSession.getState().toggleSwitch("bend");
    expect(useSession.getState().machine.switches.bend).toBe(false);

    useSession.getState().setReg(3, 1234);
    expect(useSession.getState().machine.regs[3]).toBe(1234);

    useSession.getState().setMemoryValues([5, 6, 7]);
    const m = useSession.getState().machine;
    expect([m.memory[0], m.memory[1], m.memory[2]]).toEqual([5, 6, 7]);
    expect(m.memory).toHaveLength(32);
  });
});

describe("clearRun / commitShownToBase", () => {
  it("clearRun drops the timeline but keeps the pre-run base", () => {
    useSession.getState().setReg(1, 42);
    useSession.getState().run("datapath");
    useSession.getState().scrubTo(4);
    useSession.getState().clearRun();
    const s = useSession.getState();
    expect(s.timeline).toHaveLength(0);
    expect(s.status).toBe("idle");
    expect(s.machine.regs[1]).toBe(42); // base, not scrubbed state
  });

  it("commitShownToBase bakes the shown state into the edit base", () => {
    useSession.getState().run("datapath");
    useSession.getState().scrubTo(5); // run to the end: R0 gets the ADD result
    useSession.getState().commitShownToBase();
    const s = useSession.getState();
    expect(s.timeline).toHaveLength(0);
    expect(s.machine.regs[s.machine.knobs.CAddr]).toBe(0); // 0+0 wrote back
    expect(s.status).toBe("idle");
  });
});

describe("feature toggles", () => {
  it("changing features mid-run clears the run", () => {
    useSession.getState().run("datapath");
    useSession.getState().tick();
    useSettings.setState({ features: PRESET_FEATURES.plusMemory });
    const s = useSession.getState();
    expect(s.timeline).toHaveLength(0);
    expect(s.status).toBe("idle");
  });
});

describe("micro runs", () => {
  it("runs programmed micro rows 0..4 and stops at xx", () => {
    reset(PRESET_FEATURES.plusMicro);
    // one programmed row: R1 <- R0 + R0
    useSession.getState().setMachine({
      micro: [
        { AAddr: "00", BAddr: "00", ALU: "00", CAddr: "01", MMAddr: "00000", SW: "1001" },
        ...createMachine().micro.slice(1),
      ],
    });
    useSession.getState().setReg(0, 21);
    useSession.getState().run("micro");
    const s = useSession.getState();
    // actor step + 5 datapass steps = 6; row 1 is "xx" so the run stops
    expect(s.timeline.length).toBe(6);
    for (let i = 0; i < s.timeline.length; i++) useSession.getState().tick();
    expect(shownState(useSession.getState()).regs[1]).toBe(42);
  });

  it("instruction decode drives knobs from the IR (ADD R1 R2 R3)", () => {
    reset(PRESET_FEATURES.full);
    const ADD_R1_R2_R3 = parseInt("1010000100" + "01" + "10" + "11", 2);
    useSession.getState().setMemoryValues([ADD_R1_R2_R3]);
    useSession.getState().setReg(2, 3);
    useSession.getState().setReg(3, 4);
    useSession.getState().run("instruction");
    const n = useSession.getState().timeline.length;
    for (let i = 0; i < n; i++) useSession.getState().tick();
    const final = shownState(useSession.getState());
    expect(final.pc).toBe(1);
    expect(final.regs[1]).toBe(7);
    // decode step snapshot shows the synthesized microinstruction on knobs
    const decode = useSession.getState().timeline.find((st) => st.kind === "decode")!;
    expect(toBits(decode.state.knobs.AAddr, 2)).toBe("10"); // Ra = R2
    expect(toBits(decode.state.knobs.CAddr, 2)).toBe("01"); // Rd = R1
  });
});
