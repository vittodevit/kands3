import type { FeatureSet, MachineState, Step, StepKind, Word } from "./types";
import { alu } from "./alu";
import { applyToKnobs, decodeInstruction } from "./microcode";
import { disassemble, isBranchEncoding, isHaltEncoding } from "./assembler";

/** Deep-ish clone so steps never alias the input state. */
function clone(s: MachineState): MachineState {
  return {
    ...s,
    regs: [...s.regs] as MachineState["regs"],
    memory: [...s.memory],
    knobs: { ...s.knobs },
    switches: { ...s.switches },
    flags: s.flags ? { ...s.flags } : null,
    microIR: s.microIR ? { ...s.microIR } : null,
    micro: s.micro.map((m) => ({ ...m })),
  };
}

function step(kind: StepKind, st: MachineState, actors: string[], narration: string, weight: 1 | 4 = 1): Step {
  return { kind, state: clone(st), actors, narration, weight };
}

const wrap = (n: number): number => n % 32;

/**
 * One datapath pass, exactly the 6-stage chain of datapath.html (§4.1):
 *
 *   1. regs → A/B buses          (knobs AAddr/BAddr)
 *   2. A/B buses → ALU latches
 *   3. ALU computes (flags set); in parallel, when memory exists,
 *      memory[memRW] is read onto the MM Bus
 *   4. ALU-C and/or MM Bus → C bus (bend / fromMemory; both closed →
 *      bitwise OR + a 'contention' step; both open in memory mode →
 *      the C bus holds its previous value, as in the original)
 *   5. C bus → regs[CAddr] if CArrow closed (always, without memory);
 *      if toMemory closed, MM Bus ← C bus
 *   6. if toMemory closed, memory[memRW] ← MM Bus (weight 4)
 */
export function buildDatapathPass(s: MachineState, f: FeatureSet): Step[] {
  const steps: Step[] = [];
  let st = clone(s);

  // Stage 1: registers → A/B buses.
  const aReg = st.knobs.AAddr;
  const bReg = st.knobs.BAddr;
  st.aBus = st.regs[aReg] ?? 0;
  st.bBus = st.regs[bReg] ?? 0;
  steps.push(
    step(
      "busTransfer",
      st,
      [`reg:R${aReg}`, "wire:a-bus", `reg:R${bReg}`, "wire:b-bus", "knob:AAddr", "knob:BAddr"],
      `Registers R${aReg} and R${bReg} drive the A and B buses.`,
    ),
  );

  // Stage 2: A/B buses → ALU input latches.
  st.aluA = st.aBus;
  st.aluB = st.bBus;
  steps.push(
    step(
      "busTransfer",
      st,
      ["wire:a-bus", "latch:aluA", "wire:b-bus", "latch:aluB"],
      `A and B bus values are latched into the ALU inputs.`,
    ),
  );

  // Stage 3: ALU computes; flags set; memory read onto MM Bus in parallel.
  const { result, flags } = alu(st.knobs.ALU, st.aluA, st.aluB);
  st.aluC = result;
  st.flags = flags;
  const aluActors = ["knob:ALU", "latch:aluC", "flag:zero", "flag:negative", "flag:unsignedOverflow", "flag:signedOverflow"];
  let aluNarr: string;
  if (f.memory) {
    st.mmBus = st.memory[st.memRW] ?? 0;
    aluActors.push(`mem:${st.memRW}`, "wire:mm-bus");
    aluNarr = `ALU computes (result ${result}); in parallel, memory[${st.memRW}] is read onto the MM Bus.`;
  } else {
    aluNarr = `ALU computes (result ${result}); flags are set.`;
  }
  steps.push(step("aluOp", st, aluActors, aluNarr));

  // Stage 4: C bus load (bend / fromMemory; OR on contention).
  const opNames = ["ADD", "OR", "AND", "SUB"] as const;
  const opName = opNames[st.knobs.ALU];
  if (!f.memory) {
    st.cBus = st.aluC;
    steps.push(step("busTransfer", st, ["switch:bend", "latch:aluC", "wire:c-bus"], `ALU output is bent onto the C bus.`));
  } else if (st.switches.fromMemory && st.switches.bend) {
    st.cBus = (st.aluC | st.mmBus) as Word;
    steps.push(
      step(
        "contention",
        st,
        ["switch:bend", "switch:fromMemory", "latch:aluC", "wire:mm-bus", "wire:c-bus"],
        `Bus contention: bend and fromMemory are both closed, so the C bus gets the bitwise OR of the ALU output and memory.`,
      ),
    );
  } else if (st.switches.fromMemory) {
    st.cBus = st.mmBus;
    steps.push(step("busTransfer", st, ["switch:fromMemory", "wire:mm-bus", "wire:c-bus"], `Memory value is routed up onto the C bus.`));
  } else if (st.switches.bend) {
    st.cBus = st.aluC;
    steps.push(step("busTransfer", st, ["switch:bend", "latch:aluC", "wire:c-bus"], `ALU output is bent onto the C bus.`));
  } else {
    steps.push(
      step(
        "busTransfer",
        st,
        ["switch:bend", "switch:fromMemory", "wire:c-bus"],
        `Bend and fromMemory are both open, so the C bus holds its previous value (no ${opName} result is written).`,
      ),
    );
  }

  // Stage 5: C bus → register (CArrow) and MM Bus ← C bus (toMemory).
  const writeReg = !f.memory || st.switches.CArrow;
  let regNarr: string;
  if (writeReg) {
    st.regs[st.knobs.CAddr] = st.cBus;
    regNarr = `C bus value is written into R${st.knobs.CAddr}.`;
  } else {
    regNarr = `The "to registers" switch is open, so no register is written.`;
  }
  if (f.memory && st.switches.toMemory) {
    st.mmBus = st.cBus;
    regNarr += ` C bus value is placed on the MM Bus for the memory write.`;
  }
  steps.push(
    step(
      writeReg ? "regWrite" : "busTransfer",
      st,
      writeReg
        ? ["switch:CArrow", "wire:c-bus", `reg:R${st.knobs.CAddr}`, "knob:CAddr"]
        : ["switch:CArrow", "wire:c-bus"],
      regNarr,
    ),
  );

  // Stage 6: memory write (slow write).
  if (f.memory && st.switches.toMemory) {
    st.memory[st.memRW] = st.mmBus;
    steps.push(
      step(
        "memWrite",
        st,
        ["switch:toMemory", "wire:mm-bus", `mem:${st.memRW}`],
        `Writing memory[${st.memRW}] is a slow write and takes longer than a register write.`,
        4,
      ),
    );
  }

  return steps;
}

/** True if any field of a micro row is the "xx" unprogrammed sentinel. */
function isUnprogrammed(m: { AAddr: string; BAddr: string; ALU: string; CAddr: string; MMAddr: string; SW: string }): boolean {
  return (
    m.AAddr.toLowerCase() === "xx" ||
    m.BAddr.toLowerCase() === "xx" ||
    m.ALU.toLowerCase() === "xx" ||
    m.CAddr.toLowerCase() === "xx" ||
    m.MMAddr.toLowerCase() === "xx" ||
    m.SW.toLowerCase() === "xx"
  );
}

/**
 * Increment 3: run micro rows 0..4 in order. A row containing any "xx" field
 * stops the run (no steps for that row); each row first applies its bits onto
 * the knobs/switches + memRW (an 'actor' step snapshotting the knob state),
 * then runs one datapath pass.
 */
export function buildMicroRun(s: MachineState, f: FeatureSet): Step[] {
  const steps: Step[] = [];
  let st = clone(s);
  for (let i = 0; i < 5; i++) {
    const row = st.micro[i];
    if (!row || isUnprogrammed(row)) break;
    st = applyToKnobs(st, row);
    steps.push(
      step(
        "actor",
        st,
        [`micro:${i}`, "knob:AAddr", "knob:BAddr", "knob:CAddr", "knob:ALU", "switch:CArrow", "switch:toMemory", "switch:fromMemory", "switch:bend", `mem:${st.memRW}`],
        `Microinstruction ${i} loads its bits onto the knobs and switches (R/W address ${st.memRW}).`,
      ),
    );
    const passSteps = buildDatapathPass(st, f);
    steps.push(...passSteps);
    st = passSteps[passSteps.length - 1]!.state; // continue from the pass's final snapshot
  }
  return steps;
}

/**
 * Increment 4: one instruction cycle (§4.3).
 *
 *   fetch (PC read → memory[PC] → IR) → decode (IR → microIR, knobs applied)
 *   → PC update (increment, or branch target for a taken branch)
 *   → datapath pass (only for real instructions).
 *
 * Branches act BEFORE execution: any branch encoding (taken or not) is a pure
 * PC update with no datapath pass. HALT increments the PC (as in the
 * original) then emits a 'halt' step with halted=true. NOP does
 * fetch/decode/pcUpdate only.
 */
export function buildInstructionCycle(s: MachineState): Step[] {
  const steps: Step[] = [];
  let st = clone(s);
  const pc0 = st.pc;
  const instr = st.memory[pc0] ?? 0;

  // Fetch: PC read, memory[PC] read, IR load.
  st.memRW = pc0;
  st.mmBus = instr;
  st.ir = instr;
  const d = disassemble(instr);
  steps.push(
    step(
      "fetch",
      st,
      ["ctl:pc", `mem:${pc0}`, "wire:mm-bus", "ctl:ir"],
      `Fetch: read memory[${pc0}] ("${d.valid ? d.text : "ILLEGAL OPCODE"}") into the IR.`,
    ),
  );

  // Decode: IR → microIR; the control unit applies it to knobs/switches.
  const micro = decodeInstruction(instr);
  st.microIR = micro;
  st = applyToKnobs(st, micro);
  steps.push(
    step(
      "decode",
      st,
      ["ctl:ir", "microIR", "knob:AAddr", "knob:BAddr", "knob:CAddr", "knob:ALU", "switch:CArrow", "switch:toMemory", "switch:fromMemory", "switch:bend"],
      `Decode: the control unit synthesizes the microinstruction and sets the knobs and switches.`,
    ),
  );

  // PC update (branch target for a taken branch, else +1) — BEFORE execution.
  if (isBranchEncoding(instr)) {
    const target = instr & 0x1f;
    const taken =
      d.text.startsWith("BRANCH") ||
      (d.text.startsWith("BZERO") && (st.flags?.zero ?? false)) ||
      (d.text.startsWith("BNEG") && (st.flags?.negative ?? false));
    if (taken) {
      st.pc = target;
      steps.push(step("branch", st, ["ctl:pc", "ctl:ir", "flag:zero", "flag:negative"], `Branch taken: PC ← ${target}. Branches act before execution, so no datapath pass runs.`));
    } else {
      st.pc = wrap(pc0 + 1);
      steps.push(step("pcUpdate", st, ["ctl:pc"], `Branch not taken: PC is incremented to ${st.pc}. No datapath pass runs.`));
    }
    return steps;
  }

  // Non-branch: PC increments.
  st.pc = wrap(pc0 + 1);
  steps.push(step("pcUpdate", st, ["ctl:pc"], `PC is incremented to ${st.pc}.`));

  if (isHaltEncoding(instr)) {
    st.halted = true;
    steps.push(step("halt", st, ["ctl:ir"], `HALT: the machine stops.`));
    return steps;
  }

  if (instr === 0) {
    // NOP: fetch + decode + pcUpdate only.
    return steps;
  }

  // Execute the synthesized microinstruction on the datapath.
  steps.push(...buildDatapathPass(st, { memory: true, microprog: false, control: true }));
  return steps;
}

/** Convenience: state after step i (identity — kept for clarity). */
export function stepState(steps: Step[], i: number): MachineState {
  const st = steps[Math.max(0, Math.min(i, steps.length - 1))];
  return st ? st.state : steps[0]!.state;
}
