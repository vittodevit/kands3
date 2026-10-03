import { create } from "zustand";
import type { Base, FeatureSet } from "@/core/types";

/** Animation speed levels. "fastest" is the product default (owner decision). */
export type SpeedLevel = "instant" | "fastest" | "fast" | "medium" | "slow" | "slowest";

export type Theme = "system" | "light" | "dark";

export const SPEED_LEVELS: readonly SpeedLevel[] = [
  "instant",
  "fastest",
  "fast",
  "medium",
  "slow",
  "slowest",
];

export const DEFAULT_SPEED: SpeedLevel = "fastest";

export type Preset = "datapath" | "plusMemory" | "plusMicro" | "full";

export const PRESET_FEATURES: Record<Preset, FeatureSet> = {
  datapath: { memory: false, microprog: false, control: false },
  plusMemory: { memory: true, microprog: false, control: false },
  plusMicro: { memory: true, microprog: true, control: false },
  full: { memory: true, microprog: true, control: true },
};

export type SettingsState = {
  features: FeatureSet;
  base: Base;
  speed: SpeedLevel;
  theme: Theme;
  narrations: boolean;
  setFeature: (feature: keyof FeatureSet, on: boolean) => void;
  setFeatures: (features: FeatureSet) => void;
  applyPreset: (preset: Preset) => void;
  setBase: (base: Base) => void;
  setSpeed: (speed: SpeedLevel) => void;
  setTheme: (theme: Theme) => void;
  setNarrations: (on: boolean) => void;
};

const BASES: readonly Base[] = ["-10", "10", "2"];
const THEMES: readonly Theme[] = ["system", "light", "dark"];

const STORAGE_KEY = "knobs.settings";

/* ------------------------------------------------------------------ */
/* URL query sync: ?features=memory,control&speed=fastest&base=2       */
/* ------------------------------------------------------------------ */

type UrlSettings = Partial<Pick<SettingsState, "features" | "speed" | "base">>;

function parseFeaturesParam(raw: string | null): FeatureSet | undefined {
  if (!raw) return undefined;
  const parts = raw.split(",").map((p) => p.trim());
  return {
    memory: parts.includes("memory"),
    microprog: parts.includes("microprog"),
    control: parts.includes("control"),
  };
}

function readUrlSettings(): UrlSettings {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const speed = params.get("speed");
  const base = params.get("base");
  return {
    features: parseFeaturesParam(params.get("features")),
    speed: speed && (SPEED_LEVELS as readonly string[]).includes(speed) ? (speed as SpeedLevel) : undefined,
    base: base && (BASES as readonly string[]).includes(base) ? (base as Base) : undefined,
  };
}

function writeUrl(features: FeatureSet, speed: SpeedLevel, base: Base): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const names = (Object.keys(features) as (keyof FeatureSet)[]).filter((k) => features[k]);
  const prevFeatures = parseFeaturesParam(params.get("features"));
  const sameFeatures =
    prevFeatures !== undefined &&
    (Object.keys(features) as (keyof FeatureSet)[]).every((k) => prevFeatures[k] === features[k]);
  if (names.length > 0 && !sameFeatures) params.set("features", names.join(","));
  else if (names.length === 0) params.delete("features");
  params.set("speed", speed);
  params.set("base", base);
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", url);
}

/* ------------------------------------------------------------------ */
/* Theme application (class strategy on <html>)                        */
/* ------------------------------------------------------------------ */

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyThemeClass(theme: Theme): void {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

function readStoredSettings(): Partial<SettingsState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Partial<SettingsState>;
  } catch {
    // corrupted storage — fall through to defaults
  }
  return {};
}

/** Initial state: URL query > localStorage > defaults. Dark default. */
function initialSettings(): Pick<SettingsState, "features" | "base" | "speed" | "theme" | "narrations"> {
  const stored = readStoredSettings();
  const url = readUrlSettings();
  const theme =
    stored.theme && (THEMES as readonly string[]).includes(stored.theme) ? stored.theme : "system";
  return {
    features: url.features ?? stored.features ?? PRESET_FEATURES.datapath,
    base: url.base ?? stored.base ?? "-10",
    speed: url.speed ?? stored.speed ?? DEFAULT_SPEED,
    theme,
    narrations: stored.narrations ?? true,
  };
}

/**
 * Persistence is manual (not zustand's persist middleware) so the
 * URL > localStorage > defaults precedence cannot be clobbered by a
 * rehydration merge.
 */
export const useSettings = create<SettingsState>()((set) => {
  const sync = (s: Pick<SettingsState, "features" | "speed" | "base">) =>
    writeUrl(s.features, s.speed, s.base);
  return {
    ...initialSettings(),
    setFeature: (feature, on) =>
      set((s) => {
        const features = { ...s.features, [feature]: on };
        sync({ features, speed: s.speed, base: s.base });
        return { features };
      }),
    setFeatures: (features) =>
      set((s) => {
        sync({ features, speed: s.speed, base: s.base });
        return { features };
      }),
    applyPreset: (preset) =>
      set((s) => {
        const features = { ...PRESET_FEATURES[preset] };
        sync({ features, speed: s.speed, base: s.base });
        return { features };
      }),
    setBase: (base) =>
      set((s) => {
        sync({ features: s.features, speed: s.speed, base });
        return { base };
      }),
    setSpeed: (speed) =>
      set((s) => {
        sync({ features: s.features, speed, base: s.base });
        return { speed };
      }),
    setTheme: (theme) => set({ theme }),
    setNarrations: (on) => set({ narrations: on }),
  };
});

// Persist every change (last feature set, speed, base, theme, narrations).
useSettings.subscribe((s) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        features: s.features,
        base: s.base,
        speed: s.speed,
        theme: s.theme,
        narrations: s.narrations,
      }),
    );
  } catch {
    // storage unavailable (private mode etc.) — persistence is best-effort
  }
});

/** Which increment preset matches the current feature set (for the dropdown). */
export function matchingPreset(features: FeatureSet): Preset | null {
  for (const [name, value] of Object.entries(PRESET_FEATURES) as [Preset, FeatureSet][]) {
    if (
      value.memory === features.memory &&
      value.microprog === features.microprog &&
      value.control === features.control
    ) {
      return name;
    }
  }
  return null;
}
