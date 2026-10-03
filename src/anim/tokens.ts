import type { SpeedLevel } from "@/state/settingsStore";

/**
 * Animation duration tokens (REMAKE-PLAN §8).
 *
 * Each speed level fixes the duration of ONE animation phase; a step's total
 * playback duration is that value scaled by the step's `weight` (memory
 * writes are slower — the preserved K&S latency quirk). "instant" skips phases
 * entirely, and `prefers-reduced-motion` collapses every level to instant.
 */

/** Milliseconds per phase for each speed level (instant = skip animation). */
export const PHASE_MS: Readonly<Record<SpeedLevel, number>> = {
  instant: 0,
  fastest: 80,
  fast: 160,
  medium: 320,
  slow: 640,
  slowest: 1000,
};

/** Does the user ask for reduced motion? (Safe in non-DOM environments.) */
export function reducedMotionPreferred(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Effective per-phase duration: the token value, collapsed to 0 when the
 * user prefers reduced motion.
 */
export function phaseMs(speed: SpeedLevel): number {
  return reducedMotionPreferred() ? 0 : PHASE_MS[speed];
}

/** Motion spring used by rotating knobs / traveling switch arrows. */
export const SPRING = { type: "spring", stiffness: 260, damping: 26 } as const;

/** Standard ease for fill/settle transitions. */
export const EASE = [0.4, 0, 0.2, 1] as const;
