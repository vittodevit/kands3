import type { AluOp, Flags, Word } from "./types";
import { signed } from "./numbers";

/**
 * The K&S ALU, bit-exact with datapath.html:calculateALUResult.
 *
 * ADD/SUB are computed both unsigned and signed; OR/AND are computed signed
 * only (the original sets the unsigned result to 0, which makes the unsigned
 * overflow flag false — harmless, since every flag except unsignedOverflow
 * is derived from the signed result).
 *
 *   zero            = (signed result == 0)
 *   negative        = MSB of the 16-bit two's-complement of the signed result
 *   unsignedOverflow = unsigned result not in [0, 65535]
 *   signedOverflow  = signed result not in [-32768, 32767]
 */
export function alu(op: AluOp, a: Word, b: Word): { result: Word; flags: Flags } {
  const AS = signed(a);
  const BS = signed(b);
  let s: number;
  let u: number;
  if (op === 0) {
    s = AS + BS;
    u = a + b;
  } else if (op === 1) {
    s = AS | BS;
    u = 0;
  } else if (op === 2) {
    s = AS & BS;
    u = 0;
  } else {
    s = AS - BS;
    u = a - b;
  }
  const result = (((s % 65536) + 65536) % 65536) as Word;
  return {
    result,
    flags: {
      zero: s === 0,
      negative: result >= 0x8000,
      unsignedOverflow: u > 65535 || u < 0,
      signedOverflow: s > 32767 || s < -32768,
    },
  };
}
