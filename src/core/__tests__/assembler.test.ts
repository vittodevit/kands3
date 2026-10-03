import { describe, expect, it } from "vitest";
import { ISA, assemble, disassemble, isBranchEncoding, isHaltEncoding } from "../assembler";
import { toBits } from "../numbers";

const enc = (line: string) => toBits(assemble(line) ?? -1, 16);

describe("assembler golden encodings (ARCH §2)", () => {
  it("ISA table has all 12 instructions", () => {
    expect(ISA.map((i) => i.mnemonic)).toEqual([
      "LOAD", "STORE", "MOVE", "ADD", "SUB", "AND", "OR", "BRANCH", "BZERO", "BNEG", "NOP", "HALT",
    ]);
  });

  it("golden encodings", () => {
    expect(enc("LOAD R1 5")).toBe("100000010" + "01" + "00101");
    expect(enc("LOAD R0 0")).toBe("100000010" + "00" + "00000");
    expect(enc("LOAD R3 31")).toBe("100000010" + "11" + "11111");
    expect(enc("STORE 6 R2")).toBe("100000100" + "10" + "00110");
    expect(enc("STORE 0 R0")).toBe("100000100" + "00" + "00000");
    expect(enc("STORE 31 R3")).toBe("100000100" + "11" + "11111");
    expect(enc("MOVE R3 R1")).toBe("100100010000" + "11" + "01");
    expect(enc("MOVE R0 R0")).toBe("100100010000" + "00" + "00");
    expect(enc("ADD R1 R2 R3")).toBe("1010000100" + "01" + "10" + "11");
    expect(enc("ADD R0 R0 R0")).toBe("1010000100" + "00" + "00" + "00");
    expect(enc("SUB R0 R0 R1")).toBe("1010001000" + "00" + "00" + "01");
    expect(enc("SUB R3 R2 R1")).toBe("1010001000" + "11" + "10" + "01");
    expect(enc("AND R3 R3 R3")).toBe("1010001100" + "11" + "11" + "11");
    expect(enc("AND R0 R1 R2")).toBe("1010001100" + "00" + "01" + "10");
    expect(enc("OR R0 R1 R2")).toBe("1010010000" + "00" + "01" + "10");
    expect(enc("OR R3 R0 R0")).toBe("1010010000" + "11" + "00" + "00");
    expect(enc("BRANCH 9")).toBe("00000001000" + "01001");
    expect(enc("BRANCH 0")).toBe("00000001000" + "00000");
    expect(enc("BZERO 31")).toBe("00000010000" + "11111");
    expect(enc("BNEG 0")).toBe("00000011000" + "00000");
    expect(assemble("NOP")).toBe(0x0000);
    expect(assemble("HALT")).toBe(0xffff);
  });

  it("assemble is strict about grammar", () => {
    expect(assemble("ADD R1 R2")).toBeNull();
    expect(assemble("ADD R1 R2 R3 R4")).toBeNull();
    expect(assemble("ADD R4 R0 R0")).toBeNull(); // no R4
    expect(assemble("ADD 1 2 3")).toBeNull();
    expect(assemble("LOAD R0 32")).toBeNull(); // addr out of range
    expect(assemble("LOAD R0 -1")).toBeNull();
    expect(assemble("LOAD R0")).toBeNull();
    expect(assemble("STORE R0 5")).toBeNull(); // operand order is addr first
    expect(assemble("BRANCH")).toBeNull();
    expect(assemble("BRANCH 32")).toBeNull();
    expect(assemble("NOP 3")).toBeNull();
    expect(assemble("HALT x")).toBeNull();
    expect(assemble("FOO R1 R2")).toBeNull();
    expect(assemble("")).toBeNull();
    expect(assemble("add r1 r2 r3")).toBeNull(); // case-sensitive like the original
  });

  it("assemble/disassemble round-trips across the operand space", () => {
    const lines = [
      "LOAD R2 13", "STORE 17 R1", "MOVE R3 R0", "ADD R1 R2 R3", "SUB R2 R2 R0",
      "AND R0 R3 R1", "OR R3 R1 R2", "BRANCH 12", "BZERO 5", "BNEG 30", "NOP", "HALT",
    ];
    for (const line of lines) {
      const w = assemble(line);
      expect(w, line).not.toBeNull();
      expect(disassemble(w as number).text).toBe(line);
      expect(disassemble(w as number).valid).toBe(true);
    }
    for (let rd = 0; rd < 4; rd++)
      for (let ra = 0; ra < 4; ra++)
        for (let rb = 0; rb < 4; rb++)
          expect(disassemble(assemble(`ADD R${rd} R${ra} R${rb}`) as number).text)
            .toBe(`ADD R${rd} R${ra} R${rb}`);
    for (let a = 0; a < 32; a++)
      expect(disassemble(assemble(`LOAD R1 ${a}`) as number).text).toBe(`LOAD R1 ${a}`);
  });
});

describe("disassembler (baseconv.js:getInstruction)", () => {
  it("keys on the first 9 bits", () => {
    // LOAD prefix, low 7 bits zero → still LOAD R0 0
    expect(disassemble(0b100000010_0000000 as number).text).toBe("LOAD R0 0");
    // Same opcode key as BZERO but with garbage in the low 7 bits still decodes.
    expect(disassemble(0b000000100_1111111 as number).text).toBe("BZERO 31");
  });

  it("marks non-encodings invalid", () => {
    expect(disassemble(1).valid).toBe(false);
    expect(disassemble(1).text).toBe("ILLEGAL OPCODE");
    expect(disassemble(0b1010101010000000 as number).valid).toBe(false);
    // first-9 prefix of LOAD with an impossible... (LOAD key is exact)
    expect(disassemble(0b100000011_0000000 as number).valid).toBe(false);
    // NOP and HALT are full-word matches, not 9-bit keys
    expect(disassemble(1).text).toBe("ILLEGAL OPCODE");
  });

  it("NOP and HALT", () => {
    expect(disassemble(0)).toEqual({ text: "NOP", valid: true });
    expect(disassemble(0xffff)).toEqual({ text: "HALT", valid: true });
  });
});

describe("encoding predicates", () => {
  it("isBranchEncoding", () => {
    expect(isBranchEncoding(assemble("BRANCH 9") as number)).toBe(true);
    expect(isBranchEncoding(assemble("BZERO 1") as number)).toBe(true);
    expect(isBranchEncoding(assemble("BNEG 31") as number)).toBe(true);
    expect(isBranchEncoding(assemble("LOAD R0 0") as number)).toBe(false);
    expect(isBranchEncoding(0)).toBe(false);
    expect(isBranchEncoding(0xffff)).toBe(false);
  });

  it("isHaltEncoding", () => {
    expect(isHaltEncoding(0xffff)).toBe(true);
    expect(isHaltEncoding(0xfffe)).toBe(false);
    expect(isHaltEncoding(assemble("HALT") as number)).toBe(true);
    expect(isHaltEncoding(0)).toBe(false);
  });
});
