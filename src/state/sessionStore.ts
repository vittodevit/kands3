import { create } from "zustand";
import type { KnobName, MachineState, Step, SwitchName, Word } from "@/core/types";
import { buildDatapathPass, buildInstructionCycle, buildMicroRun } from "@/core/sequencer";
import { createMachine } from "@/core/machine";
import { useSettings } from "@/state/settingsStore";

/**
 * Session store (CONTRACT Addendum v2) — machine state + run timeline +
 * cursor. Playback moves only the cursor; the sequencer pre-computes whole
 * runs as pure Step[] snapshots, which makes pause/scrub/undo free.
 */

export type RunStatus = "idle" | "running" | "paused" | "done" | "halted";
export type RunKind = "datapath" | "micro" | "instruction";

export type SessionState = {
  /** Base (edit-mode) machine state — the state at cursor 0. */
  machine: MachineState;
  /** Steps of the current run (empty when no run). */
  timeline: Step[];
  /** Index into timeline; shown state = timeline[cursor-1].state ?? machine. */
  cursor: number;
  status: RunStatus;
  /** == timeline[cursor-1] when cursor > 0, else null. */
  activeStep: Step | null;

  // ── Edit intents (all clear the timeline → back to edit mode) ──
  setMachine(patch: Partial<MachineState>): void;
  turnKnob(name: KnobName, position: 0 | 1 | 2 | 3): void;
  toggleSwitch(name: SwitchName): void;
  setReg(index: 0 | 1 | 2 | 3, value: Word): void;
  setMemoryValues(values: Word[]): void;

  // ── Run intents ──
  run(kind: RunKind): void;
  /**
   * Continue the program: build the next cycle from the END of the existing
   * timeline and APPEND it (comprehensive full-run history in full-machine
   * mode). Delegates to run() when there is no timeline; no-ops when the
   * machine has halted or is already running. A scrubbed-back playhead is
   * jumped to the end before appending.
   */
  continueRun(kind: RunKind): void;
  pause(): void;
  resume(): void;
  halt(): void;
  stepForward(): void;
  stepBack(): void;
  scrubTo(i: number): void;
  tick(): void;
  clearRun(): void;
  commitShownToBase(): void;
};

/**
 * The machine state currently shown: the last played step's snapshot, or the
 * base machine when at cursor 0 / no run (CONTRACT Addendum v2 derivation).
 */
export function shownState(s: Pick<SessionState, "machine" | "timeline" | "cursor">): MachineState {
  return s.timeline.length > 0 && s.cursor > 0 ? (s.timeline[s.cursor - 1]!.state) : s.machine;
}

function endStatus(steps: Step[]): RunStatus {
  const last = steps[steps.length - 1];
  if (last && (last.kind === "halt" || last.state.halted)) return "halted";
  return "done";
}

function activeAt(steps: Step[], cursor: number): Step | null {
  return cursor > 0 ? (steps[cursor - 1] ?? null) : null;
}

export const useSession = create<SessionState>()((set, get) => ({
  machine: createMachine(useSettings.getState().features),
  timeline: [],
  cursor: 0,
  status: "idle",
  activeStep: null,

  setMachine: (patch) =>
    set((s) => ({
      machine: { ...s.machine, ...patch },
      timeline: [],
      cursor: 0,
      activeStep: null,
      status: "idle",
    })),

  turnKnob: (name, position) =>
    set((s) => ({ machine: { ...s.machine, knobs: { ...s.machine.knobs, [name]: position } } , timeline: [], cursor: 0, activeStep: null, status: "idle" })),

  toggleSwitch: (name) =>
    set((s) => ({
      machine: { ...s.machine, switches: { ...s.machine.switches, [name]: !s.machine.switches[name] } },
      timeline: [],
      cursor: 0,
      activeStep: null,
      status: "idle",
    })),

  setReg: (index, value) =>
    set((s) => {
      const regs = [...s.machine.regs] as MachineState["regs"];
      regs[index] = value;
      return { machine: { ...s.machine, regs }, timeline: [], cursor: 0, activeStep: null, status: "idle" };
    }),

  setMemoryValues: (values) =>
    set((s) => {
      const memory = [...s.machine.memory];
      for (let i = 0; i < Math.min(values.length, memory.length); i++) memory[i] = values[i]!;
      return { machine: { ...s.machine, memory }, timeline: [], cursor: 0, activeStep: null, status: "idle" };
    }),

  run: (kind) => {
    const s = get();
    const base = shownState(s);
    const features = useSettings.getState().features;
    const timeline =
      kind === "datapath"
        ? buildDatapathPass(base, features)
        : kind === "micro"
          ? buildMicroRun(base, features)
          : buildInstructionCycle(base);
    set({
      machine: base,
      timeline,
      cursor: 0,
      activeStep: null,
      status: timeline.length > 0 ? "running" : endStatus(timeline),
    });
  },

  continueRun: (kind) => {
    const s = get();
    if (s.status === "running") return;
    if (s.timeline.length === 0) {
      get().run(kind);
      return;
    }
    const endStep = s.timeline[s.timeline.length - 1]!;
    if (endStep.state.halted) return; // machine halted — nothing more to run
    const features = useSettings.getState().features;
    const more =
      kind === "datapath"
        ? buildDatapathPass(endStep.state, features)
        : kind === "micro"
          ? buildMicroRun(endStep.state, features)
          : buildInstructionCycle(endStep.state);
    if (more.length === 0) return;
    const timeline = [...s.timeline, ...more];
    // Playhead at the segment boundary; `machine` (the cursor-0 base) is
    // deliberately untouched so scrubbing to 0 still shows the run's start.
    const cursor = s.timeline.length;
    set({ timeline, cursor, activeStep: activeAt(timeline, cursor), status: "running" });
  },

  pause: () => set((s) => (s.status === "running" ? { status: "paused" } : {})),

  resume: () =>
    set((s) =>
      s.status === "paused" && s.cursor < s.timeline.length ? { status: "running" } : {},
    ),

  /** Stop playback (edit mode); the timeline stays for inspection/scrub. */
  halt: () => set((s) => (s.status === "running" || s.status === "paused" ? { status: "idle" } : {})),

  stepForward: () =>
    set((s) => {
      if (s.cursor >= s.timeline.length) return {};
      const cursor = s.cursor + 1;
      const atEnd = cursor >= s.timeline.length;
      const status: RunStatus =
        s.status === "running" ? "paused" : atEnd ? endStatus(s.timeline) : s.status;
      return { cursor, activeStep: activeAt(s.timeline, cursor), status };
    }),

  stepBack: () =>
    set((s) => {
      if (s.cursor === 0) return {};
      const cursor = s.cursor - 1;
      return { cursor, activeStep: activeAt(s.timeline, cursor) };
    }),

  scrubTo: (i) =>
    set((s) => {
      if (s.timeline.length === 0) return {};
      const cursor = Math.min(Math.max(i, 0), s.timeline.length);
      const atEnd = cursor >= s.timeline.length;
      const status: RunStatus = atEnd ? endStatus(s.timeline) : "paused";
      return { cursor, activeStep: activeAt(s.timeline, cursor), status };
    }),

  tick: () =>
    set((s) => {
      if (s.status !== "running" || s.cursor >= s.timeline.length) return {};
      const cursor = s.cursor + 1;
      if (cursor >= s.timeline.length) {
        return { cursor, activeStep: activeAt(s.timeline, cursor), status: endStatus(s.timeline) };
      }
      return { cursor, activeStep: activeAt(s.timeline, cursor) };
    }),

  clearRun: () => set({ timeline: [], cursor: 0, activeStep: null, status: "idle" }),

  /** "Restore & apply": make the currently shown state the new edit base. */
  commitShownToBase: () =>
    set((s) => ({
      machine: shownState(s),
      timeline: [],
      cursor: 0,
      activeStep: null,
      status: "idle",
    })),
}));

/**
 * Feature toggles mid-run clear the run and return to edit mode
 * (REMAKE-PLAN §3.4: "Switching a feature off mid-run clears the run").
 */
let lastFeatures = useSettings.getState().features;
useSettings.subscribe((s) => {
  const changed =
    s.features.memory !== lastFeatures.memory ||
    s.features.microprog !== lastFeatures.microprog ||
    s.features.control !== lastFeatures.control;
  lastFeatures = s.features;
  if (changed) useSession.getState().clearRun();
});

/** Imperative handle for keyboard shortcuts (⌘Z / ⇧⌘Z) and tests. */
export const sessionActions = {
  stepBack: () => useSession.getState().stepBack(),
  stepForward: () => useSession.getState().stepForward(),
};
