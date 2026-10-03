# Knobs — Assembly & Machine Language Instruction Set

K & S Model 2 — Assembly & Machine Language Instruction Set

The machine has four 16-bit registers (`R0`–`R3`), 32 words of 16-bit main
memory (`M[0]`–`M[31]`), and a 5-bit program counter (`PC`). Every instruction
is exactly 16 bits. This is the same instruction set as the original
[Knob & Switch Computer](https://users.dickinson.edu/~braught/kands/kands.html),
preserved bit-for-bit.

In the encodings below, `RR` is a 2-bit register number and `MMMMM` is a 5-bit
memory address (0–31).

## Data Movement Instructions

| Assembly Language Instruction | Example | Meaning | Machine Language Instruction |
|---|---|---|---|
| `LOAD [REG] [MEM]` | `LOAD R2 13` | R2 = M[13] | `1 000 0001 0 RR MMMMM` |
| `STORE [MEM] [REG]` | `STORE 8 R3` | M[8] = R3 | `1 000 0010 0 RR MMMMM` |
| `MOVE [REG1] [REG2]` | `MOVE R2 R0` | R2 = R0 | `1 001 0001 0000 RR RR` |

## Arithmetic and Logic Instructions

| Assembly Language Instruction | Example | Meaning | Machine Language Instruction |
|---|---|---|---|
| `ADD [REG1] [REG2] [REG3]` | `ADD R3 R2 R1` | R3 = R2 + R1 | `1 010 0001 00 RR RR RR` |
| `SUB [REG1] [REG2] [REG3]` | `SUB R3 R1 R0` | R3 = R1 − R0 | `1 010 0010 00 RR RR RR` |
| `AND [REG1] [REG2] [REG3]` | `AND R0 R3 R1` | R0 = R3 & R1 | `1 010 0011 00 RR RR RR` |
| `OR [REG1] [REG2] [REG3]` | `OR R2 R2 R3` | R2 = R2 \| R3 | `1 010 0100 00 RR RR RR` |

## Branching Instructions

| Assembly Language Instruction | Example | Meaning | Machine Language Instruction |
|---|---|---|---|
| `BRANCH [MEM]` | `BRANCH 10` | PC = 10 | `0 000 0001 000 MMMMM` |
| `BZERO [MEM]` | `BZERO 2` | PC = 2 IF ALU RESULT IS ZERO | `0 000 0010 000 MMMMM` |
| `BNEG [MEM]` | `BNEG 7` | PC = 7 IF ALU RESULT IS NEGATIVE | `0 000 0011 000 MMMMM` |

Branches act **before** the datapath pass of the current instruction cycle: the
condition is tested against the flags left by the most recent ALU operation.
`BZERO`/`BNEG` fall through when their condition is false.

## Other Instructions

| Assembly Language Instruction | Example | Meaning | Machine Language Instruction |
|---|---|---|---|
| `NOP` | `NOP` | Do nothing. | `0000 0000 0000 0000` |
| `HALT` | `HALT` | Halt the machine. | `1111 1111 1111 1111` |

## Assembly language notes

- Tokens are separated by **single spaces**; mnemonics and register names are
  case-sensitive as shown (`ADD R1 R2 R3`, not `add r1 r2 r3`).
- Memory addresses are decimal, 0–31.
- The assembly editor in the app assembles one line at a time and shows `ERR`
  for anything that doesn't match the grammar; memory words can equally be
  entered as raw 16-bit binary.
- The full encoding table, as implemented in `src/core/assembler.ts`:

| Mnemonic | Encoding (bit 15 → bit 0) |
|---|---|
| `LOAD`  | `100000010 Rd(2) addr(5)` |
| `STORE` | `100000100 Rs(2) addr(5)` |
| `MOVE`  | `100100010000 Rd(2) Rs(2)` |
| `ADD`   | `1010000100 Rd(2) Ra(2) Rb(2)` |
| `SUB`   | `1010001000 Rd(2) Ra(2) Rb(2)` |
| `AND`   | `1010001100 Rd(2) Ra(2) Rb(2)` |
| `OR`    | `1010010000 Rd(2) Ra(2) Rb(2)` |
| `BRANCH`| `00000001000 addr(5)` |
| `BZERO` | `00000010000 addr(5)` |
| `BNEG`  | `00000011000 addr(5)` |
| `NOP`   | `0000000000000000` |
| `HALT`  | `1111111111111111` |

## ALU flags

The ALU (ADD / OR / AND / SUB knob positions) sets four flags after every
operation: **Zero**, **Negative**, **Unsigned Overflow**, and **Signed
Overflow** (computed from the signed result, per the original semantics). Only
Zero and Negative are consulted, by `BZERO` and `BNEG` respectively.
