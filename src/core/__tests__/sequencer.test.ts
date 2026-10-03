import { describe, expect, it } from "vitest";
import { buildDatapathPass, buildInstructionCycle, buildMicroRun, stepState } from "../sequencer";
import { assemble } from "../assembler";
import { createMachine } from "../machine";
import type { MachineState } from "../types";

const mem = (m: Partial<MachineState>): MachineState => {
  const s = createMachine();
  Object.assign(s, m);
  return s;
};

describe("buildDatapathPass", () => {
  it("moves a value through the whole datapath (no memory)", () => {
    const s = mem({ regs: [7, 0, 0, 0] });
    s.knobs = { AAddr: 0, BAddr: 0, CAddr: 2, ALU: 0 };
    const steps = buildDatapathPass(s, { memory: false, microprog: false, control: false });
    const st = steps[steps.length - 1]!.state;
    expect(st.regs[2]).toBe(14); // 7 + 7
    expect(st.aluC).toBe(14);
    expect(st.cBus).toBe(14);
    expect(st.flags?.zero).toBe(false);
    expect(steps.map((x) => x.kind)).toEqual(["busTransfer", "busTransfer", "aluOp", "busTransfer", "regWrite"]);
    expect(steps.every((x) => x.weight === 1)).toBe(true);
  });

  it("does not write a register when CArrow is open (memory mode)", () => {
    const s = mem({ regs: [7, 0, 0, 0] });
    s.switches = { CArrow: false, toMemory: false, fromMemory: false, bend: true };
    const steps = buildDatapathPass(s, { memory: true, microprog: false, control: false });
    expect(steps[steps.length - 1]!.state.regs[0]).toBe(7);
    expect(steps[4]!.kind).toBe("busTransfer"); // no regWrite emitted
  });

  it("contention: fromMemory + bend both closed → bitwise OR on the C bus", () => {
    const s = mem({ regs: [5, 0, 0, 0], memory: new Array(32).fill(0) });
    s.memory[3] = 0b1010;
    s.memRW = 3;
    s.knobs = { AAddr: 0, BAddr: 0, CAddr: 0, ALU: 0 }; // ADD R0+R0 = 10
    s.switches = { CArrow: true, toMemory: false, fromMemory: true, bend: true };
    const steps = buildDatapathPass(s, { memory: true, microprog: false, control: false });
    const contention = steps.find((x) => x.kind === "contention");
    expect(contention).toBeDefined();
    expect(contention!.state.cBus).toBe(5 + 5 | 0b1010); // aluC=10 OR mmBus=10
    // make them distinct to be sure it's an OR, not a pick
    const s2 = mem({ regs: [3, 0, 0, 0] });
    s2.memory[7] = 0b1000;
    s2.memRW = 7;
    s2.switches = { CArrow: true, toMemory: false, fromMemory: true, bend: true };
    const steps2 = buildDatapathPass(s2, { memory: true, microprog: false, control: false });
    const c = steps2.find((x) => x.kind === "contention")!;
    expect(c.state.aluC).toBe(6); // 3+3
    expect(c.state.mmBus).toBe(8);
    expect(c.state.cBus).toBe(6 | 8); // 14 — the OR, neither input alone
    expect(steps2[steps2.length - 1]!.state.regs[0]).toBe(14); // written through CArrow
  });

  it("fromMemory alone routes memory onto the C bus", () => {
    const s = mem({});
    s.memory[9] = 0x1234;
    s.memRW = 9;
    s.switches = { CArrow: true, toMemory: false, fromMemory: true, bend: false };
    const steps = buildDatapathPass(s, { memory: true, microprog: false, control: false });
    const st = steps[steps.length - 1]!.state;
    expect(st.cBus).toBe(0x1234);
    expect(st.regs[0]).toBe(0x1234);
  });

  it("memory write has weight 4, everything else 1", () => {
    const s = mem({ regs: [42, 0, 0, 0] });
    s.knobs = { AAddr: 0, BAddr: 0, CAddr: 0, ALU: 1 }; // OR
    s.switches = { CArrow: false, toMemory: true, fromMemory: false, bend: true };
    const steps = buildDatapathPass(s, { memory: true, microprog: false, control: false });
    const kinds = steps.map((x) => x.kind);
    expect(kinds).toEqual(["busTransfer", "busTransfer", "aluOp", "busTransfer", "busTransfer", "memWrite"]);
    expect(steps[5]!.weight).toBe(4);
    expect(steps.filter((x) => x.weight === 4)).toHaveLength(1);
    const final = steps[5]!.state;
    expect(final.memory[0]).toBe(42);
  });

  it("with both bend and fromMemory open, the C bus keeps its old value (original quirk)", () => {
    const s = mem({ regs: [9, 0, 0, 0] });
    s.cBus = 0x0f0f;
    s.switches = { CArrow: true, toMemory: false, fromMemory: false, bend: false };
    const steps = buildDatapathPass(s, { memory: true, microprog: false, control: false });
    const st = steps[steps.length - 1]!.state;
    expect(st.cBus).toBe(0x0f0f);
    expect(st.regs[0]).toBe(0x0f0f); // old C bus value written
  });

  it("is pure: the input state is not mutated", () => {
    const s = mem({ regs: [7, 0, 0, 0] });
    const before = JSON.stringify(s);
    buildDatapathPass(s, { memory: true, microprog: false, control: false });
    buildMicroRun(s, { memory: true, microprog: true, control: false });
    buildInstructionCycle(s);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("buildMicroRun", () => {
  it("stops at the first row containing any 'xx' field", () => {
    const s = createMachine();
    s.micro = [
      { AAddr: "00", BAddr: "00", ALU: "00", CAddr: "01", MMAddr: "00000", SW: "1001" },
      { AAddr: "xx", BAddr: "00", ALU: "00", CAddr: "00", MMAddr: "00000", SW: "1001" }, // xx in AAddr
      { AAddr: "00", BAddr: "00", ALU: "00", CAddr: "10", MMAddr: "00000", SW: "1001" },
    ];
    const steps = buildMicroRun(s, { memory: true, microprog: true, control: false });
    // row 0 = 1 actor step + 5 datapath steps; row 1 stops the run
    expect(steps).toHaveLength(6);
    expect(steps[0]!.kind).toBe("actor");
    expect(steps.some((x) => x.state.regs[2] !== 0)).toBe(false); // row 2 never ran
  });

  it("runs all 5 rows when programmed", () => {
    const s = createMachine();
    s.regs[0] = 3;
    const row = (c: string): MachineState["micro"][number] => ({ AAddr: "00", BAddr: "00", ALU: "00", CAddr: c, MMAddr: "00000", SW: "1001" });
    s.micro = [row("00"), row("01"), row("10"), row("11"), row("00")];
    const steps = buildMicroRun(s, { memory: false, microprog: true, control: false });
    expect(steps.filter((x) => x.kind === "actor")).toHaveLength(5);
    // R0=3 → 6; R1 ← 12; R2 ← 24; R3 ← 24; last row re-doubles R0 → 48
    const st = steps[steps.length - 1]!.state;
    expect(st.regs).toEqual([12, 12, 12, 12]);
  });

  it("each row first applies its bits (actor step snapshots knob state)", () => {
    const s = createMachine();
    s.micro[0] = { AAddr: "01", BAddr: "10", ALU: "11", CAddr: "11", MMAddr: "10101", SW: "1001" };
    const steps = buildMicroRun(s, { memory: true, microprog: true, control: false });
    const a = steps[0]!;
    expect(a.kind).toBe("actor");
    expect(a.actors).toContain("micro:0");
    expect(a.state.knobs).toEqual({ AAddr: 1, BAddr: 2, CAddr: 3, ALU: 3 });
    expect(a.state.memRW).toBe(21);
    expect(a.narration).toMatch(/Microinstruction 0/);
  });
});

describe("buildInstructionCycle", () => {
  const load = (prog: string[], extra?: (s: MachineState) => void): MachineState => {
    const s = createMachine({ memory: true, microprog: false, control: true });
    prog.forEach((line, i) => (s.memory[i] = assemble(line) ?? 0));
    extra?.(s);
    return s;
  };

  it("fetch, decode, pcUpdate, then datapath pass for a real instruction", () => {
    const s = load(["ADD R1 R2 R3"], (st) => {
      st.regs[2] = 4;
      st.regs[3] = 5;
    });
    const steps = buildInstructionCycle(s);
    expect(steps.map((x) => x.kind)).toEqual(["fetch", "decode", "pcUpdate", "busTransfer", "busTransfer", "aluOp", "busTransfer", "regWrite"]);
    const st = steps[steps.length - 1]!.state;
    expect(st.ir).toBe(assemble("ADD R1 R2 R3"));
    expect(st.regs[1]).toBe(9);
    expect(st.pc).toBe(1);
  });

  it("LOAD reads memory through the datapath", () => {
    const s = load(["LOAD R2 7"], (st) => (st.memory[7] = 0x2a2a));
    const steps = buildInstructionCycle(s);
    const st = steps[steps.length - 1]!.state;
    expect(st.regs[2]).toBe(0x2a2a);
    expect(st.memRW).toBe(7);
  });

  it("STORE writes memory with weight 4", () => {
    const s = load(["STORE 6 R1"], (st) => (st.regs[1] = 1234));
    const steps = buildInstructionCycle(s);
    const memWrite = steps.find((x) => x.kind === "memWrite")!;
    expect(memWrite).toBeDefined();
    expect(memWrite.weight).toBe(4);
    expect(steps[steps.length - 1]!.state.memory[6]).toBe(1234);
  });

  it("branch instructions execute BEFORE the pass: taken branch is a pure PC update", () => {
    const s = load(["BRANCH 12"]);
    const steps = buildInstructionCycle(s);
    expect(steps.map((x) => x.kind)).toEqual(["fetch", "decode", "branch"]);
    expect(steps[steps.length - 1]!.state.pc).toBe(12);
    expect(steps.some((x) => x.kind === "aluOp" || x.kind === "busTransfer")).toBe(false);
  });

  it("BZERO branches only when the Zero flag is set (branch acts before execution)", () => {
    const taken = load(["BZERO 20"], (st) => (st.flags = { zero: true, negative: false, unsignedOverflow: false, signedOverflow: false }));
    expect(buildInstructionCycle(taken).map((x) => x.kind)).toEqual(["fetch", "decode", "branch"]);
    expect(buildInstructionCycle(taken)[2]!.state.pc).toBe(20);

    const notTaken = load(["BZERO 20"], (st) => (st.flags = { zero: false, negative: false, unsignedOverflow: false, signedOverflow: false }));
    const steps = buildInstructionCycle(notTaken);
    expect(steps.map((x) => x.kind)).toEqual(["fetch", "decode", "pcUpdate"]);
    expect(steps[2]!.state.pc).toBe(1);
  });

  it("BNEG branches on the Negative flag", () => {
    const s = load(["BNEG 5"], (st) => (st.flags = { zero: false, negative: true, unsignedOverflow: false, signedOverflow: false }));
    const steps = buildInstructionCycle(s);
    expect(steps[2]!.kind).toBe("branch");
    expect(steps[2]!.state.pc).toBe(5);
  });

  it("untaken branch still skips the datapath pass (pure PC update)", () => {
    const s = load(["BNEG 5"], (st) => (st.flags = { zero: false, negative: false, unsignedOverflow: false, signedOverflow: false }));
    const steps = buildInstructionCycle(s);
    expect(steps.map((x) => x.kind)).toEqual(["fetch", "decode", "pcUpdate"]);
    expect(steps.every((x) => x.weight === 1)).toBe(true);
  });

  it("HALT: increments PC (original behavior) then halts", () => {
    const s = load(["HALT"]);
    s.memory[4] = assemble("HALT") as number;
    s.pc = 4;
    const steps = buildInstructionCycle(s);
    expect(steps.map((x) => x.kind)).toEqual(["fetch", "decode", "pcUpdate", "halt"]);
    const st = steps[steps.length - 1]!.state;
    expect(st.halted).toBe(true);
    expect(st.pc).toBe(5);
  });

  it("NOP: fetch + decode + pcUpdate only", () => {
    const s = load(["NOP"]);
    const steps = buildInstructionCycle(s);
    expect(steps.map((x) => x.kind)).toEqual(["fetch", "decode", "pcUpdate"]);
    expect(steps[2]!.state.pc).toBe(1);
  });

  it("PC wraps at 32", () => {
    const s = load(["NOP"]);
    s.pc = 31;
    expect(buildInstructionCycle(s)[2]!.state.pc).toBe(0);
  });

  it("stepState returns the snapshot after step i", () => {
    const s = load(["ADD R0 R0 R0"]);
    const steps = buildInstructionCycle(s);
    expect(stepState(steps, steps.length - 1).regs[0]).toBe(0);
    expect(stepState(steps, 0).ir).toBe(assemble("ADD R0 R0 R0"));
    expect(stepState(steps, 99).pc).toBe(1); // clamped to the last step
  });
});
