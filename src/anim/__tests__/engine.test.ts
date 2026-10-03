/**
 * Animation engine tests: speed-token durations, weight scaling, phase
 * windows, and the usePlayback timer chain (drives sessionStore.tick).
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { stepDuration, usePlayback } from "@/anim/engine";
import { PHASE_MS, phaseMs } from "@/anim/tokens";
import { phaseAt, phasesFor } from "@/anim/phases";
import type { Step } from "@/core/types";
import { createMachine } from "@/core/machine";
import { useSession } from "@/state/sessionStore";
import { useSettings, DEFAULT_SPEED } from "@/state/settingsStore";

const step = (weight: 1 | 4): Step => ({
  kind: weight === 4 ? "memWrite" : "busTransfer",
  state: createMachine(),
  actors: [],
  narration: "",
  weight,
});

describe("durations", () => {
  it("maps speed levels to the token table (instant=0, fastest≈80 … slowest=1000)", () => {
    expect(PHASE_MS.instant).toBe(0);
    expect(PHASE_MS.fastest).toBe(80);
    expect(PHASE_MS.fast).toBe(160);
    expect(PHASE_MS.medium).toBe(320);
    expect(PHASE_MS.slow).toBe(640);
    expect(PHASE_MS.slowest).toBe(1000);
  });

  it("scales a step's total duration by its weight (memory writes are slower)", () => {
    expect(stepDuration(step(1), "fastest")).toBe(80);
    expect(stepDuration(step(4), "fastest")).toBe(320);
    expect(stepDuration(step(4), "slow")).toBe(2560);
  });

  it("instant collapses to zero", () => {
    expect(stepDuration(step(4), "instant")).toBe(0);
  });

  it("phaseMs honors reduced-motion by collapsing to 0", () => {
    const mq = { matches: true };
    vi.stubGlobal("matchMedia", () => mq);
    expect(phaseMs("slowest")).toBe(0);
    vi.unstubAllGlobals();
  });
});

describe("phase declarations", () => {
  it("phase windows tile [0,1] without gaps or overlaps", () => {
    for (const kind of ["busTransfer", "memWrite", "aluOp", "halt"] as const) {
      const st = { ...step(1), kind };
      const phases = phasesFor(st);
      expect(phases[0]!.from).toBe(0);
      expect(phases[phases.length - 1]!.to).toBe(1);
      for (let i = 1; i < phases.length; i++) {
        expect(phases[i]!.from).toBe(phases[i - 1]!.to);
      }
    }
  });

  it("phaseAt resolves the active phase and clamps", () => {
    const st = step(1);
    expect(phaseAt(st, 0).id).toBe("energize");
    expect(phaseAt(st, 0.5).id).toBe("transfer");
    expect(phaseAt(st, 1).id).toBe("settle");
    expect(phaseAt(st, -1).id).toBe("energize");
    expect(phaseAt(st, 9).id).toBe("settle");
  });

  it("memory writes hold the transfer phase longest (slow write visible)", () => {
    const mem = phasesFor(step(4));
    const transfer = mem.find((p) => p.id === "transfer")!;
    expect(transfer.to - transfer.from).toBeGreaterThan(0.6);
  });
});

describe("usePlayback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useSettings.setState({ speed: DEFAULT_SPEED }); // fastest = 80ms/phase
    useSession.setState({
      timeline: [],
      cursor: 0,
      status: "idle",
      activeStep: null,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("drives tick on a timer while running and finishes as done", () => {
    useSession.getState().run("datapath");
    expect(useSession.getState().timeline.length).toBeGreaterThan(0);
    const { unmount } = renderHook(() => usePlayback());
    useSession.setState({ status: "running" });

    const n = useSession.getState().timeline.length;
    // Each step lasts 80ms (weight 1) at "fastest".
    act(() => {
      vi.advanceTimersByTime(80 * n);
    });
    expect(useSession.getState().cursor).toBe(n);
    expect(useSession.getState().status).toBe("done");
    unmount();
  });

  it("pauses: no ticks fire while paused", () => {
    useSession.getState().run("datapath");
    const { unmount } = renderHook(() => usePlayback());
    useSession.setState({ status: "running" });
    act(() => {
      vi.advanceTimersByTime(80);
    });
    expect(useSession.getState().cursor).toBe(1);

    useSession.getState().pause();
    act(() => {
      vi.advanceTimersByTime(80 * 10);
    });
    expect(useSession.getState().cursor).toBe(1); // frozen
    unmount();
  });

  it("unmounting cancels the pending timeout", () => {
    useSession.getState().run("datapath");
    const { unmount } = renderHook(() => usePlayback());
    useSession.setState({ status: "running" });
    unmount();
    act(() => {
      vi.advanceTimersByTime(80 * 10);
    });
    expect(useSession.getState().cursor).toBe(0);
  });
});
