import type { MicroInst, MachineState, Word } from "./types";
import { toBits } from "./numbers";

/**
 * Capture the current knob/switch/RW settings into a microinstruction
 * (microir.js:loadKnobsAndSwitches). SW bit order: CArrow,toMemory,
 * fromMemory,bend; '1' = closed.
 */
export function encodeFromKnobs(s: MachineState): MicroInst {
  const sw =
    (s.switches.CArrow ? "1" : "0") +
    (s.switches.toMemory ? "1" : "0") +
    (s.switches.fromMemory ? "1" : "0") +
    (s.switches.bend ? "1" : "0");
  return {
    AAddr: toBits(s.knobs.AAddr, 2),
    BAddr: toBits(s.knobs.BAddr, 2),
    CAddr: toBits(s.knobs.CAddr, 2),
    ALU: toBits(s.knobs.ALU, 2),
    MMAddr: toBits(s.memRW, 5),
    SW: sw,
  };
}

/**
 * Push a microinstruction's bits onto the knobs/switches and select the
 * memory R/W address (microir.js:setKnobsAndSwitches). Pure: returns a new
 * state.
 */
export function applyToKnobs(s: MachineState, m: MicroInst): MachineState {
  return {
    ...s,
    knobs: {
      AAddr: parseInt(m.AAddr, 2) as MachineState["knobs"]["AAddr"],
      BAddr: parseInt(m.BAddr, 2) as MachineState["knobs"]["BAddr"],
      CAddr: parseInt(m.CAddr, 2) as MachineState["knobs"]["CAddr"],
      ALU: parseInt(m.ALU, 2) as MachineState["knobs"]["ALU"],
    },
    switches: {
      CArrow: m.SW.charAt(0) === "1",
      toMemory: m.SW.charAt(1) === "1",
      fromMemory: m.SW.charAt(2) === "1",
      bend: m.SW.charAt(3) === "1",
    },
    memRW: parseInt(m.MMAddr, 2),
  };
}

/**
 * The hard-wired decoder (control.html:setNewMicroIR), keyed on the
 * disassembled mnemonic's first two letters, exactly the ARCHITECTURE §3
 * table. Unknown opcodes (incl. HALT/NOP/branches) decode to all zeros.
 */
export function decodeInstruction(w: Word): MicroInst {
  const b = toBits(w, 16).padStart(16, "0");
  const key = b.substring(0, 9);
  const Z = { AAddr: "00", BAddr: "00", CAddr: "00", ALU: "00", MMAddr: "00000", SW: "0000" };
  switch (key) {
    case "100000010": // LOAD
      return { AAddr: "00", BAddr: "00", CAddr: b.substring(9, 11), ALU: "00", MMAddr: b.substring(11, 16), SW: "1010" };
    case "100000100": // STORE
      return {
        AAddr: b.substring(9, 11),
        BAddr: b.substring(9, 11),
        CAddr: "00",
        ALU: "01",
        MMAddr: b.substring(11, 16),
        SW: "0101",
      };
    case "100100010": // MOVE
      return { AAddr: b.substring(14, 16), BAddr: b.substring(14, 16), CAddr: b.substring(12, 14), ALU: "01", MMAddr: "00000", SW: "1001" };
    case "101000010": // ADD
      return { AAddr: b.substring(12, 14), BAddr: b.substring(14, 16), CAddr: b.substring(10, 12), ALU: "00", MMAddr: "00000", SW: "1001" };
    case "101000100": // SUB
      return { AAddr: b.substring(12, 14), BAddr: b.substring(14, 16), CAddr: b.substring(10, 12), ALU: "11", MMAddr: "00000", SW: "1001" };
    case "101000110": // AND
      return { AAddr: b.substring(12, 14), BAddr: b.substring(14, 16), CAddr: b.substring(10, 12), ALU: "10", MMAddr: "00000", SW: "1001" };
    case "101001000": // OR
      return { AAddr: b.substring(12, 14), BAddr: b.substring(14, 16), CAddr: b.substring(10, 12), ALU: "01", MMAddr: "00000", SW: "1001" };
    default:
      return Z;
  }
}
