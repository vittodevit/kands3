import type { Base, Word } from "./types";

/** Interpret a 16-bit word as a two's-complement signed value. */
export function signed(w: Word): number {
  return w >= 0x8000 ? w - 65536 : w;
}

/** Render a word for display in the given base (see CONTRACT numbers.ts). */
export function toBase(w: Word, base: Base): string {
  if (base === "-10") return String(signed(w));
  if (base === "10") return String(w);
  return toBits(w, 16);
}

/**
 * Strict parser: returns the 16-bit word for valid text in the given base,
 * null otherwise.
 *  - "-10": optional '-', decimal digits, value in [-32768, 65535]
 *  - "10" : decimal digits, value in [0, 65535]
 *  - "2"  : 1..16 binary digits
 */
export function parseValue(text: string, base: Base): Word | null {
  if (base === "-10") {
    if (!/^-?\d+$/.test(text)) return null;
    const n = Number(text);
    if (!Number.isSafeInteger(n) || n < -32768 || n > 65535) return null;
    return (((n % 65536) + 65536) % 65536) as Word;
  }
  if (base === "10") {
    if (!/^\d+$/.test(text)) return null;
    const n = Number(text);
    if (n > 65535) return null;
    return n as Word;
  }
  if (!/^[01]{1,16}$/.test(text)) return null;
  return (parseInt(text, 2) & 0xffff) as Word;
}

/** Low `len` bits of `w` as a binary string (default 16). */
export function toBits(w: Word, len = 16): string {
  return (w & ((1 << len) - 1)).toString(2).padStart(len, "0");
}

/** Parse a binary string back to a word; null if it is not all 0s/1s. */
export function fromBits(bits: string): Word | null {
  if (!/^[01]{1,16}$/.test(bits)) return null;
  return (parseInt(bits, 2) & 0xffff) as Word;
}
