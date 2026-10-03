import type { Word } from "./types";
import { toBits } from "./numbers";

/**
 * ISA table — bit-exact from ARCHITECTURE.md §2 (bit 15 → bit 0).
 */
export const ISA: ReadonlyArray<{
  mnemonic: string;
  encoding: string;
  format: string;
  semantics: string;
}> = [
  { mnemonic: "LOAD", encoding: "100000010 Rd(2) addr(5)", format: "LOAD Rd addr", semantics: "Rd ← M[addr]" },
  { mnemonic: "STORE", encoding: "100000100 Rs(2) addr(5)", format: "STORE addr Rs", semantics: "M[addr] ← Rs" },
  { mnemonic: "MOVE", encoding: "100100010000 Rd(2) Rs(2)", format: "MOVE Rd Rs", semantics: "Rd ← Rs" },
  { mnemonic: "ADD", encoding: "1010000100 Rd(2) Ra(2) Rb(2)", format: "ADD Rd Ra Rb", semantics: "Rd ← Ra + Rb" },
  { mnemonic: "SUB", encoding: "1010001000 Rd(2) Ra(2) Rb(2)", format: "SUB Rd Ra Rb", semantics: "Rd ← Ra − Rb" },
  { mnemonic: "AND", encoding: "1010001100 Rd(2) Ra(2) Rb(2)", format: "AND Rd Ra Rb", semantics: "Rd ← Ra & Rb" },
  { mnemonic: "OR", encoding: "1010010000 Rd(2) Ra(2) Rb(2)", format: "OR Rd Ra Rb", semantics: "Rd ← Ra | Rb" },
  { mnemonic: "BRANCH", encoding: "00000001000 addr(5)", format: "BRANCH addr", semantics: "PC ← addr" },
  { mnemonic: "BZERO", encoding: "00000010000 addr(5)", format: "BZERO addr", semantics: "PC ← addr if Zero" },
  { mnemonic: "BNEG", encoding: "00000011000 addr(5)", format: "BNEG addr", semantics: "PC ← addr if Negative" },
  { mnemonic: "NOP", encoding: "0000000000000000", format: "NOP", semantics: "nothing" },
  { mnemonic: "HALT", encoding: "1111111111111111", format: "HALT", semantics: "stop the machine" },
];

const reg = (t: string | undefined): number | null =>
  t !== undefined && /^R[0-3]$/.test(t) ? Number(t.charAt(1)) : null;

const addr = (t: string | undefined): number | null => {
  if (t === undefined || !/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 0 && n <= 31 ? n : null;
};

/**
 * Assemble one line ("ADD R1 R2 R3", single spaces, exact grammar from
 * ARCHITECTURE.md §2). Returns null for anything invalid.
 */
export function assemble(line: string): Word | null {
  const p = line.split(" ");
  const m = p[0];
  if (m === "LOAD") {
    const d = reg(p[1]);
    const a = addr(p[2]);
    if (d === null || a === null || p.length !== 3) return null;
    return parseInt("100000010" + toBits(d, 2) + toBits(a, 5), 2) as Word;
  }
  if (m === "STORE") {
    const a = addr(p[1]);
    const s = reg(p[2]);
    if (a === null || s === null || p.length !== 3) return null;
    return parseInt("100000100" + toBits(s, 2) + toBits(a, 5), 2) as Word;
  }
  if (m === "MOVE") {
    const d = reg(p[1]);
    const s = reg(p[2]);
    if (d === null || s === null || p.length !== 3) return null;
    return parseInt("100100010000" + toBits(d, 2) + toBits(s, 2), 2) as Word;
  }
  const threeReg = (prefix: string): Word | null => {
    const d = reg(p[1]);
    const a = reg(p[2]);
    const b = reg(p[3]);
    if (d === null || a === null || b === null || p.length !== 4) return null;
    return parseInt(prefix + toBits(d, 2) + toBits(a, 2) + toBits(b, 2), 2) as Word;
  };
  if (m === "ADD") return threeReg("1010000100");
  if (m === "SUB") return threeReg("1010001000");
  if (m === "AND") return threeReg("1010001100");
  if (m === "OR") return threeReg("1010010000");
  const oneAddr = (prefix: string): Word | null => {
    const a = addr(p[1]);
    if (a === null || p.length !== 2) return null;
    return parseInt(prefix + toBits(a, 5), 2) as Word;
  };
  if (m === "BRANCH") return oneAddr("00000001000");
  if (m === "BZERO") return oneAddr("00000010000");
  if (m === "BNEG") return oneAddr("00000011000");
  if (m === "NOP") return p.length === 1 ? 0 : null;
  if (m === "HALT") return p.length === 1 ? 0xffff : null;
  return null;
}

/**
 * Disassemble a word, keying on the first 9 bits exactly like
 * baseconv.js:getInstruction. valid=false for non-encodings.
 */
export function disassemble(w: Word): { text: string; valid: boolean } {
  const b = toBits(w, 16);
  const key = b.substring(0, 9);
  const rd2 = (i: number) => parseInt(b.substring(i, i + 2), 2);
  const a5 = () => parseInt(b.substring(11, 16), 2);
  switch (key) {
    case "100000010":
      return { text: `LOAD R${rd2(9)} ${a5()}`, valid: true };
    case "100000100":
      return { text: `STORE ${a5()} R${rd2(9)}`, valid: true };
    case "100100010":
      return { text: `MOVE R${rd2(12)} R${rd2(14)}`, valid: true };
    case "101000010":
      return { text: `ADD R${rd2(10)} R${rd2(12)} R${rd2(14)}`, valid: true };
    case "101000100":
      return { text: `SUB R${rd2(10)} R${rd2(12)} R${rd2(14)}`, valid: true };
    case "101000110":
      return { text: `AND R${rd2(10)} R${rd2(12)} R${rd2(14)}`, valid: true };
    case "101001000":
      return { text: `OR R${rd2(10)} R${rd2(12)} R${rd2(14)}`, valid: true };
    case "000000010":
      return { text: `BRANCH ${a5()}`, valid: true };
    case "000000100":
      return { text: `BZERO ${a5()}`, valid: true };
    case "000000110":
      return { text: `BNEG ${a5()}`, valid: true };
    default:
      if (w === 0) return { text: "NOP", valid: true };
      if (w === 0xffff) return { text: "HALT", valid: true };
      return { text: "ILLEGAL OPCODE", valid: false };
  }
}

/** True for BRANCH/BZERO/BNEG encodings (first 9 bits). */
export function isBranchEncoding(w: Word): boolean {
  const key = toBits(w, 16).substring(0, 9);
  return key === "000000010" || key === "000000100" || key === "000000110";
}

/** True only for the all-ones HALT encoding. */
export function isHaltEncoding(w: Word): boolean {
  return w === 0xffff;
}
