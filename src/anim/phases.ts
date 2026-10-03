import type { Step, StepKind } from "@/core/types";

/**
 * Phase declarations (REMAKE-PLAN §8): each timeline step resolves into a
 * fixed sequence of animation phases — declared data, not imperative code.
 * A phase is a window [from, to] as a fraction of the step's TOTAL duration
 * (which the engine derives from the speed token × step.weight).
 */

export type PhaseId = "energize" | "transfer" | "latch" | "settle";

export type Phase = {
  id: PhaseId;
  /** Start of the phase window, as a fraction of total step duration. */
  from: number;
  /** End of the phase window, as a fraction of total step duration. */
  to: number;
};

/** Default phase windows: energize → transfer → latch → settle. */
const DEFAULT_PHASES: readonly Phase[] = [
  { id: "energize", from: 0, to: 0.2 },
  { id: "transfer", from: 0.2, to: 0.65 },
  { id: "latch", from: 0.65, to: 0.85 },
  { id: "settle", from: 0.85, to: 1 },
];

/** Memory writes spend most of their extended slow-write duration transferring. */
const MEM_WRITE_PHASES: readonly Phase[] = [
  { id: "energize", from: 0, to: 0.1 },
  { id: "transfer", from: 0.1, to: 0.8 },
  { id: "latch", from: 0.8, to: 0.9 },
  { id: "settle", from: 0.9, to: 1 },
];

/** The phase windows used when playing back one step of the given kind. */
export function phasesFor(step: Step): readonly Phase[] {
  return memWeighted(step.kind) ? MEM_WRITE_PHASES : DEFAULT_PHASES;
}

function memWeighted(kind: StepKind): boolean {
  return kind === "memWrite";
}

/** Which phase is active at time fraction t (0..1)? Clamps outside [0,1]. */
export function phaseAt(step: Step, t: number): Phase {
  const phases = phasesFor(step);
  const clamped = Math.min(1, Math.max(0, t));
  for (const p of phases) {
    if (clamped >= p.from && clamped < p.to) return p;
  }
  return phases[phases.length - 1]!;
}
