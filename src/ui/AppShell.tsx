import { useEffect, type ReactNode } from "react";
import { CircuitBoard, ListOrdered, MemoryStick, Monitor, Moon, Sun } from "lucide-react";
import { Panel, Select, Switch, IconButton } from "@/ui/primitives";
import { Logo } from "@/ui/Logo";
import { translate as t, useT, type TranslationKey } from "@/i18n/useT";
import {
  SPEED_LEVELS,
  applyThemeClass,
  matchingPreset,
  resolveTheme,
  useSettings,
  type Preset,
  type SpeedLevel,
  type Theme,
} from "@/state/settingsStore";
import type { Base } from "@/core/types";
import { cn } from "@/lib/utils";

export type AppShellProps = {
  /** Machine canvas (SVG datapath scene) mounted in the main area. */
  canvas?: ReactNode;
  /** Full-height left rail (main memory). */
  memoryRail?: ReactNode;
  /** Right-dock panel contents; omitted → placeholder panels. */
  narrationPanel?: ReactNode;
  historyPanel?: ReactNode;
  editorPanel?: ReactNode;
};

const THEME_ORDER: readonly Theme[] = ["system", "light", "dark"];

const SPEED_LABEL_KEYS: Record<SpeedLevel, TranslationKey> = {
  instant: "topbar.speed.instant",
  fastest: "topbar.speed.fastest",
  fast: "topbar.speed.fast",
  medium: "topbar.speed.medium",
  slow: "topbar.speed.slow",
  slowest: "topbar.speed.slowest",
};

const THEME_LABEL_KEYS: Record<Theme, TranslationKey> = {
  system: "topbar.theme.system",
  light: "topbar.theme.light",
  dark: "topbar.theme.dark",
};

/**
 * One-page chrome: slim top bar (feature toggles, increment presets, base,
 * speed, theme) + machine canvas + collapsible right dock. Panels and the
 * canvas arrive as slots so stage components can mount inside unchanged.
 */
export function AppShell({ canvas, memoryRail, narrationPanel, historyPanel, editorPanel }: AppShellProps) {
  const tWord = useT();
  const features = useSettings((s) => s.features);
  const base = useSettings((s) => s.base);
  const speed = useSettings((s) => s.speed);
  const theme = useSettings((s) => s.theme);
  const setFeature = useSettings((s) => s.setFeature);
  const applyPreset = useSettings((s) => s.applyPreset);
  const setBase = useSettings((s) => s.setBase);
  const setSpeed = useSettings((s) => s.setSpeed);
  const setTheme = useSettings((s) => s.setTheme);

  // Theme: class strategy on <html>; "system" tracks prefers-color-scheme.
  useEffect(() => {
    applyThemeClass(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeClass("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const cycleTheme = () => {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]!;
    setTheme(next);
  };
  const resolved = resolveTheme(theme);
  const themeIcon = theme === "system" ? <Monitor aria-hidden /> : resolved === "dark" ? <Moon aria-hidden /> : <Sun aria-hidden />;

  const presetValue = matchingPreset(features) ?? "custom";

  return (
    <div className="flex h-full min-h-0 flex-col bg-base text-ink">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="z-20 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2">
        <div className="flex items-center gap-2.5">
          <Logo className="h-11 w-11" />
          <h1 className="sr-only">{tWord("app.title")}</h1>
        </div>

        <div
          role="group"
          aria-label={tWord("topbar.features.label")}
          className="flex flex-col items-center gap-0.5"
        >
          <div className="flex items-center gap-1.5">
            <FeatureChip
              icon={<MemoryStick aria-hidden className="h-3.5 w-3.5" />}
              label={tWord("topbar.features.memory")}
              checked={features.memory}
              onCheckedChange={(on) => setFeature("memory", on)}
            />
            <FeatureChip
              icon={<ListOrdered aria-hidden className="h-3.5 w-3.5" />}
              label={tWord("topbar.features.microprog")}
              checked={features.microprog}
              onCheckedChange={(on) => setFeature("microprog", on)}
            />
            <FeatureChip
              icon={<CircuitBoard aria-hidden className="h-3.5 w-3.5" />}
              label={tWord("topbar.features.control")}
              checked={features.control}
              onCheckedChange={(on) => setFeature("control", on)}
            />
          </div>
          {/* Attribution — left-aligned under the toggles with breathing room */}
          <p className="mt-1.5 self-start whitespace-nowrap text-[10px] leading-none text-ink-faint">
            {tWord("topbar.attribution")}{" "}
            <a
              href="https://users.dickinson.edu/~braught/kands/kands.html"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-ink-faint underline decoration-ink-faint/40 underline-offset-2 transition-colors hover:text-ink-muted hover:decoration-ink-muted"
            >
              G. Braught
            </a>
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-end gap-3">
          <Select
            label={tWord("topbar.preset.label")}
            value={presetValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v !== "custom") applyPreset(v as Preset);
            }}
            options={[
              ...(presetValue === "custom"
                ? [{ value: "custom", label: `${tWord("topbar.preset.label")} · custom` }]
                : []),
              { value: "datapath", label: tWord("topbar.preset.datapath") },
              { value: "plusMemory", label: tWord("topbar.preset.plusMemory") },
              { value: "plusMicro", label: tWord("topbar.preset.plusMicro") },
              { value: "full", label: tWord("topbar.preset.full") },
            ]}
          />
          <Select
            label={tWord("topbar.base.label")}
            value={base}
            onChange={(e) => setBase(e.target.value as Base)}
            options={[
              { value: "-10", label: tWord("topbar.base.-10") },
              { value: "10", label: tWord("topbar.base.10") },
              { value: "2", label: tWord("topbar.base.2") },
            ]}
          />
          <Select
            label={tWord("topbar.speed.label")}
            value={speed}
            onChange={(e) => setSpeed(e.target.value as SpeedLevel)}
            options={SPEED_LEVELS.map((s) => ({
              value: s,
              label: tWord(SPEED_LABEL_KEYS[s]),
            }))}
          />
          <div className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
              {tWord("topbar.theme.label")}
            </span>
            <IconButton
              aria-label={tWord("topbar.theme.next", { theme: tWord(THEME_LABEL_KEYS[theme]) })}
              onClick={cycleTheme}
            >
              {themeIcon}
            </IconButton>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
              GitHub
            </span>
            <a
              href="https://github.com/vittodevit/kands3"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository"
              title="GitHub repository"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface border border-transparent hover:border-line transition-colors duration-150"
            >
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                fill="currentColor"
                className="h-[18px] w-[18px]"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      {/* ── Main: memory rail + machine canvas + right dock ────── */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {memoryRail && (
          <aside
            aria-label="Main memory rail"
            data-memory-rail
            className="flex max-h-[42vh] w-full shrink-0 flex-col border-b border-line bg-base lg:h-auto lg:max-h-none lg:w-[27rem] lg:border-b-0 lg:border-r"
          >
            {memoryRail}
          </aside>
        )}
        <main className="dot-grid relative min-h-[60vh] flex-1 overflow-hidden bg-canvas p-6 lg:min-h-0">
          <div className="h-full min-h-0">{canvas}</div>
        </main>
        <aside
          className={cn(
            "flex w-full shrink-0 flex-col gap-3 border-line bg-base p-3",
            "max-h-[45vh] overflow-auto lg:w-[30rem] lg:max-h-none lg:border-l lg:overflow-visible",
          )}
        >
          <Panel
            title={tWord("dock.narration.title")}
            data-panel="narration"
            className="shrink-0"
          >
            {narrationPanel ?? (
              <p className="text-xs text-ink-faint">{tWord("dock.narration.placeholder")}</p>
            )}
          </Panel>
          <Panel title={tWord("dock.history.title")} data-panel="history" className="shrink-0">
            {historyPanel ?? (
              <p className="text-xs text-ink-faint">{tWord("dock.history.placeholder")}</p>
            )}
          </Panel>
          <Panel
            title={tWord("dock.editor.title")}
            data-panel="editor"
            className="min-h-0 flex-1"
            bodyClassName="min-h-0"
          >
            {editorPanel ?? (
              <p className="text-xs text-ink-faint">{tWord("dock.editor.placeholder")}</p>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function FeatureChip({
  icon,
  label,
  checked,
  onCheckedChange,
}: {
  icon: ReactNode;
  label: string;
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
}) {
  return (
    <Switch
      aria-label={label}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="!h-7 text-xs"
    >
      <span className="flex items-center gap-1.5">
        {icon}
        {label}
      </span>
    </Switch>
  );
}

// Re-export so App can build the placeholder canvas without extra imports.
export function MachineCanvasPlaceholder() {
  return (
    <div className="flex h-full min-h-64 items-center justify-center" data-testid="canvas-empty">
      <p className="rounded-lg border border-line bg-surface/80 px-4 py-2 text-sm text-ink-faint">
        {t("canvas.empty")}
      </p>
    </div>
  );
}
