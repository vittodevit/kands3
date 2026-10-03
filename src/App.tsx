import { Suspense } from "react";
import { AppShell } from "@/ui/AppShell";
import { MachineWorkbench, MemoryStageSlot, Panels } from "@/ui/stages/stages";
import { useSettings } from "@/state/settingsStore";

/**
 * Thin root: mounts the shell with the full machine workbench (datapath +
 * toggleable memory / microprogram / control stages) and the dock panels.
 * Main memory docks as a full-height rail on the left when its feature is on.
 */
export default function App() {
  const memoryOn = useSettings((s) => s.features.memory);
  return (
    <AppShell
      canvas={<MachineWorkbench />}
      memoryRail={
        memoryOn ? (
          <Suspense fallback={null}>
            <MemoryStageSlot />
          </Suspense>
        ) : undefined
      }
      narrationPanel={<Panels.NarrationPanel />}
      historyPanel={<Panels.HistoryPanel />}
      editorPanel={<Panels.AsmEditorPanel />}
    />
  );
}
