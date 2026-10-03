export type Word = number; // 16-bit value, 0..65535
export type RegAddr = 0 | 1 | 2 | 3;
export type AluOp = 0 | 1 | 2 | 3; // 0=ADD 1=OR 2=AND 3=SUB (knob positions)
export type KnobName = "AAddr" | "BAddr" | "CAddr" | "ALU";
export type SwitchName = "CArrow" | "toMemory" | "fromMemory" | "bend";
export type Base = "-10" | "10" | "2";
export type FeatureSet = { memory: boolean; microprog: boolean; control: boolean };
export type Flags = {
  zero: boolean;
  negative: boolean;
  unsignedOverflow: boolean;
  signedOverflow: boolean;
};

export type MicroInst = {
  AAddr: string;
  BAddr: string;
  ALU: string;
  CAddr: string; // "xx" or 2-bit binary
  MMAddr: string; // "xx" or 5-bit binary
  SW: string; // "xx" or 4-bit binary (CArrow,toMemory,fromMemory,bend)
};

export type MachineState = {
  regs: [Word, Word, Word, Word];
  aBus: Word;
  bBus: Word;
  cBus: Word;
  mmBus: Word;
  aluA: Word;
  aluB: Word;
  aluC: Word;
  flags: Flags | null; // null until first ALU op
  memory: Word[]; // length 32
  memRW: number; // selected R/W address 0..31
  pc: number; // 0..31
  ir: Word | null; // set when control unit active
  microIR: MicroInst | null;
  micro: MicroInst[]; // 5 rows, the microprogram store
  knobs: { AAddr: RegAddr; BAddr: RegAddr; CAddr: RegAddr; ALU: AluOp };
  switches: { CArrow: boolean; toMemory: boolean; fromMemory: boolean; bend: boolean }; // true = closed
  halted: boolean;
};

export type StepKind =
  | "busTransfer"
  | "aluOp"
  | "regWrite"
  | "memWrite"
  | "memRead"
  | "fetch"
  | "decode"
  | "pcUpdate"
  | "branch"
  | "halt"
  | "contention"
  | "actor"; // micro-run row loading its bits onto knobs/switches (v1.1)

export type ActorId = string; // e.g. "wire:a-bus", "reg:R2", "knob:ALU", "switch:bend", "mem:12", "latch:aluA", "flag:zero", "ctl:pc", "ctl:ir", "microIR", "micro:3"

export type Step = {
  kind: StepKind;
  state: MachineState; // FULL snapshot after this step (enables scrubbing)
  actors: ActorId[]; // components to energize during this step
  narration: string; // plain-English explanation (English, i18n later)
  weight: 1 | 4; // 4 = memory write (slow write)
};
