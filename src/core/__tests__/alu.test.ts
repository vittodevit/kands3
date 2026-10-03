import { describe, expect, it } from "vitest";
import { alu } from "../alu";
import type { AluOp, Word } from "../types";

const f = (op: AluOp, a: Word, b: Word) => alu(op, a, b).flags;
const r = (op: AluOp, a: Word, b: Word) => alu(op, a, b).result;
const F = { zero: false, negative: false, unsignedOverflow: false, signedOverflow: false };

describe("ALU (datapath.html:calculateALUResult)", () => {
  it("ADD basics", () => {
    expect(r(0, 1, 2)).toBe(3);
    expect(f(0, 1, 2)).toEqual(F);
    expect(r(0, 0, 0)).toBe(0);
    expect(f(0, 0, 0)).toEqual({ ...F, zero: true });
  });

  it("ADD wraps to 16 bits", () => {
    expect(r(0, 0xffff, 2)).toBe(1); // -1 + 2 = 1
  });

  it("ADD 32767 + 1: signed overflow only", () => {
    expect(r(0, 0x7fff, 1)).toBe(0x8000);
    expect(f(0, 0x7fff, 1)).toEqual({ ...F, negative: true, signedOverflow: true });
  });

  it("ADD 65535 + 1: unsigned overflow, zero result", () => {
    expect(r(0, 0xffff, 1)).toBe(0); // -1 + 1
    expect(f(0, 0xffff, 1)).toEqual({ ...F, zero: true, unsignedOverflow: true });
  });

  it("SUB basics and zero", () => {
    expect(r(3, 9, 4)).toBe(5);
    expect(f(3, 9, 4)).toEqual(F);
    expect(r(3, 4, 4)).toBe(0);
    expect(f(3, 4, 4)).toEqual({ ...F, zero: true });
  });

  it("SUB 0 - 1: negative, both representations differ", () => {
    expect(r(3, 0, 1)).toBe(0xffff);
    expect(f(3, 0, 1)).toEqual({ ...F, negative: true, unsignedOverflow: true });
  });

  it("SUB -32768 - 1: signed overflow, result 0x7fff (positive)", () => {
    expect(r(3, 0x8000, 1)).toBe(0x7fff);
    expect(f(3, 0x8000, 1)).toEqual({ ...F, signedOverflow: true });
  });

  it("OR: signed result; unsigned overflow irrelevant (false)", () => {
    expect(r(1, 0xff00, 0x00ff)).toBe(0xffff); // -256 | 255 = -1
    expect(f(1, 0xff00, 0x00ff)).toEqual({ ...F, negative: true });
    expect(r(1, 0, 0)).toBe(0);
    expect(f(1, 0, 0)).toEqual({ ...F, zero: true });
    expect(r(1, 0b1010, 0b0110)).toBe(0b1110);
  });

  it("AND: signed result; unsigned overflow irrelevant (false)", () => {
    expect(r(2, 0xffff, 0x00ff)).toBe(0x00ff); // -1 & 255
    expect(f(2, 0xffff, 0x00ff)).toEqual(F);
    expect(r(2, 0xffff, 0)).toBe(0);
    expect(f(2, 0xffff, 0)).toEqual({ ...F, zero: true });
    expect(r(2, 0x8000, 0x8000)).toBe(0x8000); // negative & negative
    expect(f(2, 0x8000, 0x8000)).toEqual({ ...F, negative: true });
  });

  it("negative flag is the MSB of the 16-bit two's complement of the signed result", () => {
    // 32768 overflows signed range; dec2bin(32768,16) = 1000...0 → negative
    expect(f(0, 0x7fff, 1).negative).toBe(true);
    // -32768 itself
    expect(f(3, 0, 0x8000)).toEqual({ ...F, negative: true, signedOverflow: true, unsignedOverflow: true });
  });
});
