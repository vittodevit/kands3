import { describe, expect, it } from "vitest";
import { applyToKnobs, decodeInstruction, encodeFromKnobs } from "../microcode";
import { assemble } from "../assembler";
import { createMachine } from "../machine";
import type { MicroInst } from "../types";

const M = (m: Partial<MicroInst>): MicroInst => ({
  AAddr: "00", BAddr: "00", ALU: "00", CAddr: "00", MMAddr: "00000", SW: "0000", ...m,
});

describe("decoder table (control.html:setNewMicroIR, ARCH §3)", () => {
  it("LOAD", () => {
    expect(decodeInstruction(assemble("LOAD R2 7") as number)).toEqual(
      M({ CAddr: "10", MMAddr: "00111", SW: "1010" }),
    );
    expect(decodeInstruction(assemble("LOAD R0 31") as number)).toEqual(
      M({ CAddr: "00", MMAddr: "11111", SW: "1010" }),
    );
  });

  it("STORE", () => {
    expect(decodeInstruction(assemble("STORE 4 R3") as number)).toEqual(
      M({ AAddr: "11", BAddr: "11", ALU: "01", MMAddr: "00100", SW: "0101" }),
    );
    expect(decodeInstruction(assemble("STORE 0 R0") as number)).toEqual(
      M({ ALU: "01", MMAddr: "00000", SW: "0101" }),
    );
  });

  it("MOVE", () => {
    expect(decodeInstruction(assemble("MOVE R1 R0") as number)).toEqual(
      M({ ALU: "01", CAddr: "01", SW: "1001" }),
    );
    expect(decodeInstruction(assemble("MOVE R3 R2") as number)).toEqual(
      M({ AAddr: "10", BAddr: "10", ALU: "01", CAddr: "11", SW: "1001" }),
    );
  });

  it("ADD / SUB / AND / OR share the shape, differ in ALU op", () => {
    const shape = (aluOp: string) => M({ AAddr: "10", BAddr: "01", ALU: aluOp, CAddr: "11", SW: "1001" });
    expect(decodeInstruction(assemble("ADD R3 R2 R1") as number)).toEqual(shape("00"));
    expect(decodeInstruction(assemble("SUB R3 R2 R1") as number)).toEqual(shape("11"));
    expect(decodeInstruction(assemble("AND R3 R2 R1") as number)).toEqual(shape("10"));
    expect(decodeInstruction(assemble("OR R3 R2 R1") as number)).toEqual(shape("01"));
  });

  it("branches, NOP, HALT and illegal opcodes decode to all zeros", () => {
    const zeros = M({});
    expect(decodeInstruction(assemble("BRANCH 9") as number)).toEqual(zeros);
    expect(decodeInstruction(assemble("BZERO 3") as number)).toEqual(zeros);
    expect(decodeInstruction(assemble("BNEG 3") as number)).toEqual(zeros);
    expect(decodeInstruction(0)).toEqual(zeros);
    expect(decodeInstruction(0xffff)).toEqual(zeros);
    expect(decodeInstruction(1)).toEqual(zeros);
  });
});

describe("encodeFromKnobs / applyToKnobs (microir.js)", () => {
  it("captures knob/switch/RW state", () => {
    const s = createMachine();
    s.knobs = { AAddr: 1, BAddr: 2, CAddr: 3, ALU: 3 };
    s.switches = { CArrow: true, toMemory: false, fromMemory: true, bend: true };
    s.memRW = 19;
    expect(encodeFromKnobs(s)).toEqual(M({ AAddr: "01", BAddr: "10", CAddr: "11", ALU: "11", MMAddr: "10011", SW: "1011" }));
  });

  it("applies bits back onto knobs/switches and selects the R/W address", () => {
    const s0 = createMachine();
    const m = M({ AAddr: "10", BAddr: "01", CAddr: "11", ALU: "10", MMAddr: "01100", SW: "0101" });
    const s = applyToKnobs(s0, m);
    expect(s.knobs).toEqual({ AAddr: 2, BAddr: 1, CAddr: 3, ALU: 2 });
    expect(s.switches).toEqual({ CArrow: false, toMemory: true, fromMemory: false, bend: true });
    expect(s.memRW).toBe(12);
    // pure: input untouched
    expect(s0.knobs.AAddr).toBe(0);
    expect(s0.switches.toMemory).toBe(false);
  });

  it("round-trips knobs ↔ microinstruction", () => {
    const s = createMachine();
    s.knobs = { AAddr: 3, BAddr: 1, CAddr: 2, ALU: 1 };
    s.switches = { CArrow: false, toMemory: true, fromMemory: false, bend: false };
    s.memRW = 5;
    const back = applyToKnobs(createMachine(), encodeFromKnobs(s));
    expect(back.knobs).toEqual(s.knobs);
    expect(back.switches).toEqual(s.switches);
    expect(back.memRW).toBe(5);
  });
});
