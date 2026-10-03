import type { FeatureSet, MachineState, MicroInst } from "./types";

/** The all-"xx" (unprogrammed) microinstruction row. */
export function emptyMicroInst(): MicroInst {
  return { AAddr: "xx", BAddr: "xx", ALU: "xx", CAddr: "xx", MMAddr: "xx", SW: "xx" };
}

/** Resolve a partial feature selection; the default is the full machine. */
export function resolveFeatures(features?: Partial<FeatureSet>): FeatureSet {
  return { memory: true, microprog: true, control: true, ...features };
}

/**
 * Fresh machine. Defaults to the full machine (memory + microprogram store +
 * control unit); pass Partial<FeatureSet> to select an increment. The feature
 * selection itself is kept by the caller (the UI); the state shape is the
 * same for every increment — components that don't exist in an increment are
 * simply never touched.
 */
export function createMachine(features?: Partial<FeatureSet>): MachineState {
  void resolveFeatures(features); // validated/normalized here; UI keeps the result
  return {
    regs: [0, 0, 0, 0],
    aBus: 0,
    bBus: 0,
    cBus: 0,
    mmBus: 0,
    aluA: 0,
    aluB: 0,
    aluC: 0,
    flags: null,
    memory: new Array(32).fill(0),
    memRW: 0,
    pc: 0,
    ir: null,
    microIR: null,
    micro: [emptyMicroInst(), emptyMicroInst(), emptyMicroInst(), emptyMicroInst(), emptyMicroInst()],
    knobs: { AAddr: 0, BAddr: 0, CAddr: 0, ALU: 0 },
    switches: { CArrow: true, toMemory: false, fromMemory: false, bend: true },
    halted: false,
  };
}
