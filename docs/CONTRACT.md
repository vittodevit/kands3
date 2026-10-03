# Core API Contract (v1)

The authoritative interface between `src/core` (pure TS engine) and the UI
layer. The core teammate owns this file; any change here must be announced.
Behavioral ground truth: `../knob-and-switch/docs/ARCHITECTURE.md`.

## types.ts

```ts
export type Word = number;            // 16-bit value, 0..65535
export type RegAddr = 0 | 1 | 2 | 3;
export type AluOp = 0 | 1 | 2 | 3;    // 0=ADD 1=OR 2=AND 3=SUB (knob positions)
export type KnobName = "AAddr" | "BAddr" | "CAddr" | "ALU";
export type SwitchName = "CArrow" | "toMemory" | "fromMemory" | "bend";
export type Base = "-10" | "10" | "2";
export type FeatureSet = { memory: boolean; microprog: boolean; control: boolean };
export type Flags = { zero: boolean; negative: boolean; unsignedOverflow: boolean; signedOverflow: boolean };

export type MicroInst = {
  AAddr: string; BAddr: string; ALU: string; CAddr: string;   // "xx" or 2-bit binary
  MMAddr: string;                                             // "xx" or 5-bit binary
  SW: string;                                                 // "xx" or 4-bit binary (CArrow,toMemory,fromMemory,bend)
};

export type MachineState = {
  regs: [Word, Word, Word, Word];
  aBus: Word; bBus: Word; cBus: Word; mmBus: Word;
  aluA: Word; aluB: Word; aluC: Word;
  flags: Flags | null;             // null until first ALU op
  memory: Word[];                  // length 32
  memRW: number;                   // selected R/W address 0..31
  pc: number;                      // 0..31
  ir: Word | null;                 // set when control unit active
  microIR: MicroInst | null;
  micro: MicroInst[];              // 5 rows, the microprogram store
  knobs: { AAddr: RegAddr; BAddr: RegAddr; CAddr: RegAddr; ALU: AluOp };
  switches: { CArrow: boolean; toMemory: boolean; fromMemory: boolean; bend: boolean }; // true = closed
  halted: boolean;
};

export type StepKind =
  | "busTransfer" | "aluOp" | "regWrite" | "memWrite" | "memRead"
  | "fetch" | "decode" | "pcUpdate" | "branch" | "halt" | "contention"
  | "actor";   // micro-run row loading its bits onto knobs/switches (v1.1)

export type ActorId = string;      // e.g. "wire:a-bus", "reg:R2", "knob:ALU", "switch:bend", "mem:12", "latch:aluA", "flag:zero", "ctl:pc", "ctl:ir", "microIR", "micro:3"

export type Step = {
  kind: StepKind;
  state: MachineState;             // FULL snapshot after this step (enables scrubbing)
  actors: ActorId[];               // components to energize during this step
  narration: string;               // plain-English explanation (English, i18n later)
  weight: 1 | 4;                   // 4 = memory write (preserved 4x latency quirk)
};

export function createMachine(features?: Partial<FeatureSet>): MachineState;
```

## alu.ts
```ts
export function alu(op: AluOp, a: Word, b: Word): { result: Word; flags: Flags };
// Exact semantics from ARCHITECTURE.md §1.1 (flags from signed result; OR/AND unsigned ignored)
```

## numbers.ts
```ts
export function signed(w: Word): number;                 // two's complement
export function toBase(w: Word, base: Base): string;     // display string, e.g. "-5", "65531", "1111111111111011"
export function parseValue(text: string, base: Base): Word | null; // null if invalid
export function toBits(w: Word, len?: number): string;   // "0101..." length 16 default
export function fromBits(bits: string): Word | null;
```

## assembler.ts
```ts
export const ISA: ReadonlyArray<{ mnemonic: string; encoding: string; format: string; semantics: string }>;
export function assemble(line: string): Word | null;      // exact grammar from ARCH §2, single spaces; null = invalid
export function disassemble(w: Word): { text: string; valid: boolean };
// keys on first 9 bits like getInstruction; valid=false for non-encodings
export function isBranchEncoding(w: Word): boolean;
export function isHaltEncoding(w: Word): boolean;
```

## microcode.ts
```ts
export function encodeFromKnobs(s: MachineState): MicroInst;   // capture (loadKnobsAndSwitches)
export function applyToKnobs(s: MachineState, m: MicroInst): MachineState; // setKnobsAndSwitches (sets memRW from MMAddr)
export function decodeInstruction(w: Word): MicroInst;         // decoder table ARCH §3 (setNewMicroIR)
```

## sequencer.ts  (pure; every function returns steps ending in a stable state)
```ts
// One datapath pass per ARCH §4.1 (6 stages incl. contention & 4x mem weight).
export function buildDatapathPass(s: MachineState, f: FeatureSet): Step[];

// Increment 3: run micro rows 0..4 in order; stops at first "xx" field or row 5.
export function buildMicroRun(s: MachineState, f: FeatureSet): Step[];

// Increment 4: fetch → decode → execute (branch acts BEFORE execution pass;
// HALT stops). Returns steps for ONE instruction cycle.
export function buildInstructionCycle(s: MachineState): Step[];

// Convenience: apply one step's state (identity — kept for clarity).
export function stepState(steps: Step[], i: number): MachineState;
```

## Invariants (tested in core)
- Steps are pure snapshots; applying nothing mutates inputs.
- Contention: fromMemory && bend both closed → cBus = aluC | mmBus, plus a
  `contention` step.
- Memory write steps have weight 4; everything else 1.
- Branch instructions produce only pcUpdate/branch steps (no datapath pass).
- HALT produces a `halt` step and sets halted=true.

---

# Addendum v2 — session store & SVG atoms (Lead-authored)

## src/state/sessionStore.ts (zustand) — owned by teammate "machine-stage"

```ts
type RunStatus = "idle" | "running" | "paused" | "done" | "halted";
type SessionState = {
  machine: MachineState;          // base state (before timeline / when cursor=0 conceptually)
  timeline: Step[];               // steps of the current run (empty when idle)
  cursor: number;                 // index into timeline; state shown = timeline[cursor-1].state ?? machine
  status: RunStatus;
  activeStep: Step | null;        // == timeline[cursor-1] when cursor>0
  // intents
  setMachine(patch: Partial<MachineState>): void;        // edit mode (also clears timeline)
  toggleFeature-aware: edits go through here; clearing timeline returns to edit mode
  run(kind: "datapath" | "micro" | "instruction"): void; // builds timeline via sequencer, status=running
  pause(): void; resume(): void; halt(): void;
  stepForward(): void;            // advance cursor by 1 (pause if running)
  stepBack(): void;               // cursor-1
  scrubTo(i: number): void;       // set cursor, pause
  tick(): void;                   // called by anim engine timer: cursor+1; when cursor==len → status done/halted
  clearRun(): void;               // timeline=[], cursor=0, machine = shown state becomes base? (keep: machine stays at pre-run base; UI offers restore)
  commitShownToBase(): void;      // "restore & apply": base = shown state, timeline cleared
};
```
Playback pacing lives in src/anim (uses settingsStore.speed; duration scale: instant=0, fastest≈80ms/phase, fast 160, medium 320, slow 640, slowest 1000; step total duration scaled by step.weight).

## src/ui/machine atoms — owned by teammate "machine-stage", consumed by "stages-panels"

```tsx
// All SVG, theme-token colored (currentColor / var(--color-…)), motion-animated.
<Knob        position={0|1|2|3} label size onChange? disabled?>   // click advances; wheel/arrows; rotates
<SwitchArrow dir="up"|"down"|"bend"|"left" open energized label onChange? disabled?> // closed=connected path
<BusWire     id="a-bus" d={pathString} energized particles?>       // polyline w/ rounded joins; particle flow = animated stroke-dashoffset circles
<RegisterBox label value: Word energized onWrite?>
<AluBox      op energized flags?>                                 // shape + op label + flag chips
<LatchBox    label value energized>
<ValueTag    small mono label+value, for buses on canvas>
```
Stages teammate may add stage-specific atoms inside src/ui/stages/** but shared atoms live in src/ui/machine.

## Addendum v3 — full-run history (continueRun)

`sessionStore` gains `continueRun(kind: RunKind): void`:
- No timeline → delegates to `run(kind)` (identical behavior).
- Timeline present → builds the next cycle from the END state and APPENDS
  the steps (full-machine runs keep a comprehensive per-instruction history;
  the HistoryPanel groups ticks with dividers before each `fetch` step).
- No-ops when status === "running" or the end state has halted.
- A scrubbed-back playhead is jumped to the segment boundary before appending.
- `machine` (the cursor-0 base) is NOT touched, so scrub-to-0 still shows the
  run's original start. Edits (setMachine & co.) still clear everything.
- ControlStage Run/Step and the auto-continue effects (ControlStage,
  AsmEditorPanel) use continueRun; DatapathStage's Run uses it too, with a
  fresh `run()` fallback when the shown state is halted.
- `ControlStage` also has a "Reset PC" button: setMachine({pc:0, halted:false,
  ir:null, microIR:null}) — a clean restart (clears history).
