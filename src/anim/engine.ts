import { useEffect } from "react";
import type { Step } from "@/core/types";
import type { SpeedLevel } from "@/state/settingsStore";
import { useSession } from "@/state/sessionStore";
import { useSettings } from "@/state/settingsStore";
import { phaseMs } from "@/anim/tokens";

/**
 * Playback engine (REMAKE-PLAN §3.3/§8): drives `sessionStore.tick` through a
 * self-rescheduling setTimeout chain while status === "running". No rAF —
 * pacing is per-step, not per-frame. Speed changes and pause/halt cancel the
 * pending timeout (via the effect cleanup) and restart cleanly from the
 * current cursor.
 */

/** Total playback duration (ms) of one step at a speed level. */
export function stepDuration(step: Step, speed: SpeedLevel): number {
  return phaseMs(speed) * step.weight;
}

/**
 * Mount once (in <MachineWorkbench/>): advances the timeline cursor on a
 * timer while the session is running. Instant speed / reduced motion
 * collapse durations to 0 (cursor jumps as fast as timers allow).
 */
export function usePlayback(): void {
  const status = useSession((s) => s.status);
  const speed = useSettings((s) => s.speed);

  useEffect(() => {
    if (status !== "running") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const loop = () => {
      const s = useSession.getState();
      if (cancelled || s.status !== "running" || s.cursor >= s.timeline.length) return;
      const step = s.timeline[s.cursor]!;
      timer = setTimeout(() => {
        const now = useSession.getState();
        if (!cancelled && now.status === "running") now.tick();
        loop();
      }, stepDuration(step, speed));
    };

    loop();
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [status, speed]);
}
