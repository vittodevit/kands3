import { describe, expect, it } from "vitest";
import { buildDatapathPass, buildInstructionCycle, buildMicroRun } from "../sequencer";
import { assemble } from "../assembler";
import { createMachine } from "../machine";
import type { MachineState } from "../types";

/** Run instruction cycles from `s` until HALT (bounded), returning the final state. */
function runUntilHalt(s: MachineState, max = 50): MachineState {
  let st = s;
  for (let i = 0; i < max; i++) {
    const steps = buildInstructionCycle(st);
    st = steps[steps.length - 1]!.state;
    if (st.halted) return st;
  }
  throw new Error("machine did not halt");
}

describe("increment 1 — datapath only", () => {
  it("computes R3 ← R1 − R2 with SUB and negative flag", () => {
    const s = createMachine({ memory: false, microprog: false, control: false });
    s.regs = [0, 4, 9, 0];
    s.knobs = { AAddr: 1, BAddr: 2, CAddr: 3, ALU: 3 };
    const steps = buildDatapathPass(s, { memory: false, microprog: false, control: false });
    const st = steps[steps.length - 1]!.state;
    expect(st.regs[3]).toBe(0 - 5 & 0xffff); // 4 − 9 = −5 → 0xfffb
    expect(st.regs[3]).toBe(0xfffb);
    expect(st.flags?.negative).toBe(true);
    expect(steps.every((x) => x.weight === 1)).toBe(true);
    expect(steps.every((x) => x.actors.length > 0 && x.narration.length > 0)).toBe(true);
  });
});

describe("increment 3 — microprogram run", () => {
  it("doubles R0 into R1 and stores it to memory[3], stopping at an unprogrammed row", () => {
    const s = createMachine({ memory: true, microprog: true, control: false });
    s.regs[0] = 5;
    s.micro = [
      { AAddr: "00", BAddr: "00", ALU: "00", CAddr: "01", MMAddr: "00000", SW: "1001" }, // R1 ← R0+R0
      { AAddr: "01", BAddr: "01", ALU: "01", CAddr: "00", MMAddr: "00011", SW: "0101" }, // M[3] ← R1 (OR path)
      { AAddr: "xx", BAddr: "00", ALU: "00", CAddr: "00", MMAddr: "00000", SW: "0000" }, // stops the run
    ];
    const steps = buildMicroRun(s, { memory: true, microprog: true, control: false });
    const st = steps[steps.length - 1]!.state;
    expect(st.regs[1]).toBe(10);
    expect(st.memory[3]).toBe(10);
    // the STORE row's memory write is the only weight-4 step
    expect(steps.filter((x) => x.weight === 4)).toHaveLength(1);
    // two actor steps (one per executed row), none for the xx row
    expect(steps.filter((x) => x.kind === "actor")).toHaveLength(2);
  });
});

describe("increment 4 — full machine program", () => {
  it("LOAD/LOAD/ADD/STORE/BRANCH/BZERO/HALT program reaches the right final state", () => {
    const s = createMachine({ memory: true, microprog: false, control: true });
    const prog = [
      "LOAD R0 5", // 0: R0 ← M[5] = 7
      "LOAD R1 6", // 1: R1 ← M[6] = 8
      "ADD R2 R0 R1", // 2: R2 ← 15
      "STORE 7 R2", // 3: M[7] ← 15
      "BRANCH 8", // 4: jump over the data cells
      "7-data", // 5: data (skipped)
      "8-data", // 6: data (skipped)
      "skipped", // 7: overwritten by the STORE anyway
      "BZERO 11", // 8: zero flag is false (last ALU op was STORE's OR of 15) → not taken
      "HALT", // 9
    ];
    prog.forEach((line, i) => {
      if (/data/.test(line)) s.memory[i] = Number(line.charAt(0));
      else if (line !== "skipped") s.memory[i] = assemble(line) as number;
    });
    s.memory[5] = 7;
    s.memory[6] = 8;

    const st = runUntilHalt(s);
    expect(st.halted).toBe(true);
    expect(st.regs[0]).toBe(7);
    expect(st.regs[1]).toBe(8);
    expect(st.regs[2]).toBe(15);
    expect(st.memory[7]).toBe(15); // stored over the "skipped" cell
    expect(st.pc).toBe(10); // halted after fetching HALT at 9
    expect(st.ir).toBe(0xffff);
  });

  it("a taken/not-taken BZERO drives a countdown loop (branch before execute)", () => {
    const s = createMachine({ memory: true, microprog: false, control: true });
    s.memory[0] = assemble("LOAD R0 5") as number; // R0 ← M[5] = 2
    s.memory[1] = assemble("ADD R0 R0 R1") as number; // R0 ← R0 + R1 (R1 = −1)
    s.memory[2] = assemble("BZERO 4") as number; // exit the loop when zero
    s.memory[3] = assemble("BRANCH 1") as number; // loop back
    s.memory[4] = assemble("HALT") as number;
    s.memory[5] = 2; // loop counter initial value (data, never executed)
    s.regs[1] = 0xffff; // −1

    const st = runUntilHalt(s);
    expect(st.halted).toBe(true);
    expect(st.regs[0]).toBe(0);
    expect(st.memory[5]).toBe(2); // data cell untouched
    expect(st.pc).toBe(5); // 0,1,2,3,1,2,4(HALT) → PC after HALT = 5
  });

  it("every step of every cycle carries a full snapshot, actors and narration", () => {
    const s = createMachine({ memory: true, microprog: false, control: true });
    s.memory[0] = assemble("STORE 1 R2") as number;
    s.regs[2] = 9;
    for (const step of buildInstructionCycle(s)) {
      expect(Object.keys(step.state)).toContain("regs");
      expect(step.state.memory).toHaveLength(32);
      expect(step.actors.length).toBeGreaterThan(0);
      expect(typeof step.narration).toBe("string");
      expect(step.narration.length).toBeGreaterThan(0);
      expect(step.weight === 1 || step.weight === 4).toBe(true);
    }
  });
});
