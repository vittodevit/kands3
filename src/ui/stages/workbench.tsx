import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { DatapathStage } from "@/ui/stages/DatapathStage";
import { usePlayback } from "@/anim/engine";
import { useSettings } from "@/state/settingsStore";

/**
 * Stage barrel + workbench layout (HANDOFF to "stages-panels").
 *
 * ── Stage contract ──────────────────────────────────────────────────
 * Stages receive NO props; each reads sessionStore/useSettings itself:
 *   MemoryStage    — mounted while settings.features.memory; renders the
 *                    32-word grid; memory traffic uses machine.memRW.
 *   MicroprogStage — mounted while settings.features.microprog; the 5-row
 *                    µ-store (machine.micro); capture via
 *                    encodeFromKnobs(shownState(s)) committed with setMachine.
 *   ControlStage   — mounted while settings.features.control; PC/IR/µIR from
 *                    machine.pc / machine.ir / machine.microIR.
 *
 * ── Panel contract (right dock) ─────────────────────────────────────
 *   NarrationPanel — reads sessionStore.activeStep (narration + kind).
 *   HistoryPanel   — reads sessionStore.timeline/cursor/status; calls
 *                    scrubTo(i); ⌘Z/⇧⌘Z already wired to stepBack/stepForward.
 *   AsmEditorPanel — reads machine.memory; commits assembled words via
 *                    sessionStore.setMemoryValues(words: Word[]).
 *
 * The stage/panel modules are imported through per-file `import.meta.glob`
 * slots so this barrel typechecks and builds BEFORE those files land; each
 * slot renders null until its module exists (React.lazy + Suspense).
 */

const NullSlot: ComponentType = () => null;

function lazySlot(modules: Record<string, unknown>, key: string, name: string): ComponentType {
  const load = modules[key] as (() => Promise<Record<string, unknown>>) | undefined;
  return lazy(async () => {
    if (!load) return { default: NullSlot };
    const mod = await load();
    const comp = mod[name];
    return { default: typeof comp === "function" ? (comp as ComponentType) : NullSlot };
  });
}

const stageModules = {
  MemoryStage: import.meta.glob("./MemoryStage.tsx"),
  MicroprogStage: import.meta.glob("./MicroprogStage.tsx"),
  ControlStage: import.meta.glob("./ControlStage.tsx"),
} as const;

const panelModules = {
  NarrationPanel: import.meta.glob("../panels/NarrationPanel.tsx"),
  HistoryPanel: import.meta.glob("../panels/HistoryPanel.tsx"),
  AsmEditorPanel: import.meta.glob("../panels/AsmEditorPanel.tsx"),
} as const;

const MicroprogStage = lazySlot(stageModules.MicroprogStage, "./MicroprogStage.tsx", "MicroprogStage");
const ControlStage = lazySlot(stageModules.ControlStage, "./ControlStage.tsx", "ControlStage");

/** Main-memory sidebar for AppShell's full-height left rail (memoryRail slot). */
export const MemoryStageSlot = lazySlot(stageModules.MemoryStage, "./MemoryStage.tsx", "MemoryStage");

/** Lazy right-dock panel slots for App.tsx (null until each panel lands). */
export const Panels: {
  NarrationPanel: ComponentType;
  HistoryPanel: ComponentType;
  AsmEditorPanel: ComponentType;
} = {
  NarrationPanel: lazySlot(panelModules.NarrationPanel, "../panels/NarrationPanel.tsx", "NarrationPanel"),
  HistoryPanel: lazySlot(panelModules.HistoryPanel, "../panels/HistoryPanel.tsx", "HistoryPanel"),
  AsmEditorPanel: lazySlot(panelModules.AsmEditorPanel, "../panels/AsmEditorPanel.tsx", "AsmEditorPanel"),
};

function Slot({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

/**
 * The machine canvas: <DatapathStage/> always mounted on top (raised, the
 * visual centerpiece), with the Microprogram and Control Unit stages in a
 * bottom row that spans the full canvas width (between the memory rail and
 * the panel dock), the two splitting the row evenly. The main view never
 * scrolls — the SVG scales to fit; only the bottom-stage cards scroll
 * internally when space runs out.
 * Mounts the playback engine (timeline cursor timer) exactly once.
 */
export function MachineWorkbench() {
  usePlayback();
  const features = useSettings((s) => s.features);
  const bottomStages = features.microprog || features.control;
  return (
    <div className="flex h-full min-h-0 flex-col gap-4" data-workbench>
      {/* Top: the datapath scene, raised toward the top, scales to fit */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <DatapathStage />
      </div>
      {/* Bottom row: microprogram | control unit, each half the width.
          Height = content, capped; cards scroll internally past the cap. */}
      {bottomStages && (
        <div
          className="flex max-h-[min(38%,340px)] min-h-0 shrink-0 gap-4"
          data-stage-row
        >
          {features.microprog && (
            <div className="max-h-full min-w-0 flex-1 overflow-y-auto overscroll-contain">
              <Slot>
                <MicroprogStage />
              </Slot>
            </div>
          )}
          {features.control && (
            <div className="max-h-full min-w-0 flex-1 overflow-y-auto overscroll-contain">
              <Slot>
                <ControlStage />
              </Slot>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { DatapathStage };
