// @vitest-environment jsdom
/**
 * UI field tests. `@/core/*` is mocked with contract-conformant fakes so these
 * tests exercise the FIELD logic (toggling, highlighting, commit validation)
 * and stay green whether or not the core engine has landed.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

afterEach(cleanup);

const ADD_WORD = 0xa21b; // ADD R1 R2 R3  (1010000100 01 10 11)
const LOAD_R0_5 = 0x8105; // LOAD R0 5     (100000010 00 00101)

vi.mock("@/core/numbers", () => {
  const toBits = (w: number, len = 16) => w.toString(2).padStart(len, "0");
  const signed = (w: number) => (w >= 0x8000 ? w - 0x10000 : w);
  const parseValue = (text: string, base: "-10" | "10" | "2"): number | null => {
    if (base === "2") return /^[01]{1,16}$/.test(text) ? parseInt(text, 2) : null;
    if (base === "10") return /^\d{1,5}$/.test(text) && +text <= 65535 ? +text : null;
    if (/^-?\d{1,5}$/.test(text)) {
      const n = +text;
      return n >= -32768 && n <= 32767 ? (n < 0 ? n + 0x10000 : n) : null;
    }
    return null;
  };
  return { toBits, signed, parseValue, fromBits: (b: string) => parseValue(b, "2"), toBase: (w: number, base: "-10" | "10" | "2") => (base === "2" ? toBits(w) : base === "10" ? String(w) : String(signed(w))) };
});

vi.mock("@/core/assembler", () => ({
  assemble: (line: string): number | null => {
    if (line === "ADD R1 R2 R3") return ADD_WORD;
    if (line === "LOAD R0 5") return LOAD_R0_5;
    return null;
  },
  disassemble: (w: number): { text: string; valid: boolean } => {
    if (w === ADD_WORD) return { text: "ADD R1 R2 R3", valid: true };
    if (w === 0xffff) return { text: "HALT", valid: true };
    return { text: "—", valid: false };
  },
  isBranchEncoding: () => false,
  isHaltEncoding: (w: number) => w === 0xffff,
  ISA: [],
}));

import { BitSlotField } from "./BitSlotField";
import { InstructionField } from "./InstructionField";

describe("BitSlotField", () => {
  it("renders one cell per bit and flips a bit on click", () => {
    const onChange = vi.fn();
    render(<BitSlotField value={0} editable onChange={onChange} />);
    const group = screen.getByRole("group");
    const cells = within(group).getAllByRole("button");
    expect(cells).toHaveLength(16);
    expect(cells[0]).toHaveTextContent("0");
    fireEvent.click(cells[0]!); // MSB
    expect(onChange).toHaveBeenCalledWith(0x8000);
    fireEvent.click(cells[15]!); // LSB
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("sets bits with 1/0 keys and navigates with arrow keys", () => {
    const onChange = vi.fn();
    render(<BitSlotField value={0} editable onChange={onChange} />);
    const group = screen.getByRole("group");
    fireEvent.keyDown(group, { key: "1" }); // focus starts at MSB
    expect(onChange).toHaveBeenCalledWith(0x8000);
    fireEvent.keyDown(group, { key: "ArrowRight" });
    fireEvent.keyDown(group, { key: "1" }); // bit 14
    expect(onChange).toHaveBeenCalledWith(0x4000);
  });

  it("ignores interaction when not editable", () => {
    const onChange = vi.fn();
    render(<BitSlotField value={0b101} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole("button")[13]!);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("InstructionField", () => {
  it("renders a valid word with mnemonic and operand highlighting", () => {
    render(<InstructionField value={ADD_WORD} />);
    const mnemonic = screen.getByText("ADD");
    expect(mnemonic.className).toContain("text-accent-bus");
    const reg = screen.getByText("R1");
    expect(reg.className).toContain("text-accent-reg");
    expect(screen.getByText("R2")).toBeInTheDocument();
  });

  it("renders an invalid encoding with danger styling", () => {
    render(<InstructionField value={0x0200} />);
    const err = screen.getByText("ERR");
    expect(err.className).toContain("text-accent-danger");
    expect(screen.getByRole("group", { name: "Instruction" }).getAttribute("data-valid")).toBe(
      "false",
    );
  });

  it("shows an error for invalid assembly on commit instead of storing silently", () => {
    const onChange = vi.fn();
    render(<InstructionField value={ADD_WORD} editable onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "FROB R9" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("alert")).toHaveTextContent("FROB R9");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("commits a valid assembly line via onChange", () => {
    const onChange = vi.fn();
    render(<InstructionField value={ADD_WORD} editable onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "LOAD R0 5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(LOAD_R0_5);
  });
});
