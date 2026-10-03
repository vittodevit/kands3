# kands3 — the Knob & Switch Computer, rebuilt

A modern, browser-based simulator of a tiny 16-bit computer that teaches how a
CPU works — from a single ALU with hand-turned knobs all the way up to a
complete stored-program machine.

Knobs is a ground-up remake of the **Knob & Switch Computer (K&S Model 2)** by
**Grant Braught, Dickinson College** ([original project](https://users.dickinson.edu/~braught/kands/kands.html)).
All credit for the pedagogy, the machine design, and the four-increment
teaching approach belongs to the original work — this project preserves its
behavior bit-for-bit and reimagines the experience for the modern web.

## The machine

Four registers (`R0`–`R3`), an ALU (ADD / OR / AND / SUB), buses, latches, and
32 words of 16-bit RAM — all controlled literally by **knobs** (selecting
register and ALU-operation inputs) and **switches** (opening and closing the
wires to memory). The four teaching increments:

1. **Datapath** — the ALU + registers, driven by hand. Turn the knobs, close
   the switches, run a pass, watch the bits move.
2. **+ Memory** — main memory joins the datapath through the memory switches.
   Now LOAD and STORE are things you do *with your hands*, which is the point.
3. **+ Microprogramming** — a 5-word microprogram store whose bits *are* the
   knob and switch positions. "Programming" now means setting control bits.
4. **Full machine** — a control unit (PC, IR, Micro-IR) fetches machine-language
   instructions from memory and decodes each into the microinstructions that
   execute it. A real stored-program computer, and every step still visible.

The ISA: `LOAD`, `STORE`, `MOVE`, `ADD`, `SUB`, `AND`, `OR`, `BRANCH`, `BZERO`,
`BNEG`, `NOP`, `HALT` — identical encodings to the [original](https://users.dickinson.edu/~braught/kands/KandS2/instructions.html).

## New in this remake

The original behavior is preserved exactly — including its charming quirks,
like memory writes taking 4× longer than any other step, and the bus
*contention* that happens when you close `fromMemory` and `bend` at the same
time (the C bus ends up with the OR of both sources, and the simulator calls
it out). On top of that:

- **Single app, live increments.** Instead of four separate pages, one machine
  grows and shrinks via the **Memory / Microprogram / Control Unit** feature
  toggles, or one-click presets (`Datapath`, `+ Memory`, `+ Microprogramming`,
  `Full Machine`). The datapath, memory, microprogram store, and control unit
  are all visible at once and wired together.
- **Fully animated SVG datapath.** Every register, latch, bus, knob, and switch
  is a live SVG component. Energized components light up, and animated
  particles flow along buses to show values in motion. Knobs rotate, switches
  swing, values animate on writes.
- **Step-by-step narration.** Every run produces a timeline of discrete steps,
  each with a plain-English explanation ("the ALU computes R1 + R2, the result
  latches onto the C bus…"). Step kinds — bus transfer, ALU op, memory read or
  write, fetch, decode, branch, contention, halt — are labeled and color-coded.
- **Timeline scrubbing & full-run history.** Play, pause, step forward or back,
  or drag the scrubber to any point in a run — every step carries a complete
  snapshot of the machine, so any moment is exactly revisitable. Runs continue
  rather than overwrite: instruction cycles append to the history, grouped with
  dividers before each fetch, so you keep a full per-instruction record of a
  program's execution.
- **Assembly editor.** Write programs in assembly (`ADD R1 R2 R3`,
  `LOAD R0 12`, `BRANCH 4`, `HALT`), assemble them into memory, and run them.
  Memory words can also be edited as raw instructions with live validation and
  invalid encodings flagged.
- **Number base control, everywhere.** Switch every value between signed
  decimal (±10, two's complement), unsigned decimal, and 16-bit binary —
  per-word datatypes in memory are selectable too, including auto-detection of
  instructions. Bit-slot fields let you toggle individual bits and see place
  values, signed, and unsigned interpretations live.
- **Playback speed control**, from *Instant* to *Slowest* — plus a theme
  switcher (system / light / dark).
- **A pure, tested core.** The simulation engine is plain TypeScript with zero
  DOM dependencies: every run is a list of immutable step snapshots produced by
  pure functions. The ALU semantics, assembler, microcode decoder, and
  sequencer are covered by a Vitest suite (unit + integration), including the
  invariants above (contention behavior, 4× write weighting, branch/halt
  semantics, snapshot purity).

## Credits & license

This is a remake of the **Knob & Switch Computer** by **Grant Braught,
Dickinson College**: https://users.dickinson.edu/~braught/kands/kands.html

The original simulator and its paper were an inspiration for generations of
introductory computer-organization students, and every design decision here —
the knobs, the switches, the increments, even the memory-write latency — comes
directly from that work. Thank you for making the machine visible.

The original sources were released under the **GNU GPL v2**; this derivative
work is distributed under the same terms.
