/**
 * Barrel for the stage layer. The implementation lives in ./workbench.tsx
 * (JSX requires a .tsx module); this file keeps the "@/ui/stages/stages"
 * import path from the handoff contract working.
 */
export { MachineWorkbench, Panels, DatapathStage, MemoryStageSlot } from "./workbench";
