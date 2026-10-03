/**
 * Shared SVG machine atoms (CONTRACT Addendum v2). All colors flow through
 * theme tokens (var(--accent-*) / var(--text-*) / var(--surface-*)) so the
 * atoms re-theme automatically in dark/light. Consumed by DatapathStage and
 * by the other stages (MemoryStage / MicroprogStage / ControlStage).
 */
export { Knob } from "./Knob";
export type { KnobProps } from "./Knob";
export { SwitchArrow } from "./SwitchArrow";
export type { SwitchArrowProps, SwitchDir } from "./SwitchArrow";
export { BusWire } from "./BusWire";
export type { BusWireProps } from "./BusWire";
export { RegisterBox } from "./RegisterBox";
export type { RegisterBoxProps } from "./RegisterBox";
export { AluBox, ALU_OP_NAMES } from "./AluBox";
export type { AluBoxProps } from "./AluBox";
export { LatchBox } from "./LatchBox";
export type { LatchBoxProps } from "./LatchBox";
export { ValueTag } from "./ValueTag";
export type { ValueTagProps } from "./ValueTag";
