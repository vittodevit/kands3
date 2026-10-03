import { describe, expect, it } from "vitest";
import { fromBits, parseValue, signed, toBase, toBits } from "../numbers";

describe("numbers", () => {
  it("signed two's complement", () => {
    expect(signed(0)).toBe(0);
    expect(signed(5)).toBe(5);
    expect(signed(32767)).toBe(32767);
    expect(signed(32768)).toBe(-32768);
    expect(signed(65535)).toBe(-1);
  });

  it("toBase in all three bases", () => {
    expect(toBase(0xfffb, "-10")).toBe("-5");
    expect(toBase(0xfffb, "10")).toBe("65531");
    expect(toBase(0xfffb, "2")).toBe("1111111111111011");
    expect(toBase(0, "-10")).toBe("0");
    expect(toBase(0x8000, "-10")).toBe("-32768");
    expect(toBase(0x7fff, "10")).toBe("32767");
  });

  it("toBits pads and truncates", () => {
    expect(toBits(5)).toBe("0000000000000101");
    expect(toBits(5, 4)).toBe("0101");
    expect(toBits(0x1f, 5)).toBe("11111");
    expect(toBits(3, 2)).toBe("11");
  });

  it("fromBits", () => {
    expect(fromBits("0000000000000101")).toBe(5);
    expect(fromBits("1111111111111111")).toBe(65535);
    expect(fromBits("101")).toBe(5);
    expect(fromBits("")).toBeNull();
    expect(fromBits("102")).toBeNull();
    expect(fromBits("00101x")).toBeNull();
  });

  it("parseValue is strict per base", () => {
    expect(parseValue("-5", "-10")).toBe(0xfffb);
    expect(parseValue("-32768", "-10")).toBe(0x8000);
    expect(parseValue("32768", "-10")).toBe(32768); // fits in 16 bits unsigned
    expect(parseValue("65535", "-10")).toBe(65535);
    expect(parseValue("-32769", "-10")).toBeNull();
    expect(parseValue("65536", "-10")).toBeNull();
    expect(parseValue("abc", "-10")).toBeNull();
    expect(parseValue("1.5", "-10")).toBeNull();
    expect(parseValue("", "-10")).toBeNull();
    expect(parseValue("--5", "-10")).toBeNull();

    expect(parseValue("65531", "10")).toBe(65531);
    expect(parseValue("65536", "10")).toBeNull();
    expect(parseValue("-1", "10")).toBeNull();

    expect(parseValue("1111111111111011", "2")).toBe(0xfffb);
    expect(parseValue("101", "2")).toBe(5);
    expect(parseValue("11111111111111111", "2")).toBeNull(); // 17 bits
    expect(parseValue("012", "2")).toBeNull();
  });

  it("toBase/parseValue round-trips", () => {
    for (const w of [0, 1, 5, 0x7fff, 0x8000, 0xffff, 0xa5a5, 0xfffb]) {
      expect(parseValue(toBase(w, "-10"), "-10")).toBe(w);
      expect(parseValue(toBase(w, "10"), "10")).toBe(w);
      expect(parseValue(toBase(w, "2"), "2")).toBe(w);
      expect(fromBits(toBits(w))).toBe(w);
    }
  });
});
