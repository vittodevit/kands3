// @vitest-environment jsdom
/**
 * MemoryStage integration test: R/W-address radio semantics, per-cell value
 * editing through the real session store, and Inst-mode auto-assembly.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createMachine } from "@/core/machine";
import { assemble } from "@/core/assembler";
import { useSession } from "@/state/sessionStore";
import { useSettings } from "@/state/settingsStore";
import { MemoryStage } from "../MemoryStage";

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

describe("MemoryStage", () => {
  it("selecting an address sets the machine's R/W address (radio semantics)", () => {
    resetFullMachine();
    render(<MemoryStage />);
    fireEvent.click(screen.getByRole("radio", { name: "Select address 3 as the read/write address" }));
    expect(useSession.getState().machine.memRW).toBe(3);
    // Exactly one cell is marked selected.
    expect(screen.getAllByRole("radio", { checked: true })).toHaveLength(1);
  });

  it("editing a cell commits the parsed value into machine memory", () => {
    resetFullMachine();
    render(<MemoryStage />);
    const cell = screen.getByTestId("mem-cell-2");
    // The ValueField renders its current value as a button ("0" in ±10).
    const valueButton = within(cell).getByText(/^0$/).closest("button")!;
    fireEvent.click(valueButton);
    const input = within(cell).getByRole("textbox");
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(useSession.getState().machine.memory[2]).toBe(7);
  });

  it("switching a cell to Inst datatype renders an editable instruction field", () => {
    resetFullMachine();
    render(<MemoryStage />);
    const cell = screen.getByTestId("mem-cell-4");
    fireEvent.change(within(cell).getByRole("combobox"), { target: { value: "inst" } });
    // InstructionField commits assembled words: type LOAD R0 5 → 0x8105.
    fireEvent.click(within(cell).getByRole("button"));
    const input = within(cell).getByRole("textbox");
    fireEvent.change(input, { target: { value: "LOAD R0 5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(assemble("LOAD R0 5")).not.toBeNull();
    expect(useSession.getState().machine.memory[4]).toBe(assemble("LOAD R0 5"));
  });
});
