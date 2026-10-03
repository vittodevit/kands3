// @vitest-environment jsdom
/**
 * AsmEditorPanel integration test: per-line error reporting and assembling
 * the program into memory through sessionStore.setMemoryValues.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createMachine } from "@/core/machine";
import { assemble } from "@/core/assembler";
import { useSession } from "@/state/sessionStore";
import { useSettings } from "@/state/settingsStore";
import { AsmEditorPanel } from "../AsmEditorPanel";

function resetFullMachine() {
  useSettings.getState().setFeatures({ memory: true, microprog: true, control: true });
  useSession.setState({
    machine: createMachine({ memory: true, microprog: true, control: true }),
    timeline: [],
    cursor: 0,
    status: "idle",
    activeStep: null,
  });
}

afterEach(cleanup);

describe("AsmEditorPanel", () => {
  it("flags invalid lines and disables loading until fixed", () => {
    resetFullMachine();
    render(<AsmEditorPanel />);
    const textarea = screen.getByTestId("asm-textarea");
    fireEvent.change(textarea, { target: { value: "LOAD R0 5\nFROB R9" } });
    expect(screen.getByTestId("asm-errors")).toHaveTextContent(/FROB R9/);
    expect(screen.getByRole("button", { name: /load into memory/i })).toBeDisabled();
    fireEvent.change(textarea, { target: { value: "LOAD R0 5" } });
    expect(screen.queryByTestId("asm-errors")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /load into memory/i })).toBeEnabled();
  });

  it("loads the program into memory, padding the rest with NOP", () => {
    resetFullMachine();
    render(<AsmEditorPanel />);
    const program = "LOAD R0 5\nADD R0 R0 R0\nSTORE 6 R0\nHALT\nNOP\n7";
    fireEvent.change(screen.getByTestId("asm-textarea"), { target: { value: program } });
    fireEvent.click(screen.getByRole("button", { name: /load into memory/i }));

    const mem = useSession.getState().machine.memory;
    expect(mem[0]).toBe(assemble("LOAD R0 5"));
    expect(mem[1]).toBe(assemble("ADD R0 R0 R0"));
    expect(mem[2]).toBe(assemble("STORE 6 R0"));
    expect(mem[3]).toBe(0xffff); // HALT
    expect(mem[5]).toBe(7); // plain numeric line = raw data word at address 5
    expect(mem[31]).toBe(0); // NOP padding to 32 words
    expect(useSession.getState().machine.memory).toHaveLength(32);
  });
});
