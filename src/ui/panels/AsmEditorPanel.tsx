import { useEffect, useMemo, useRef, useState } from "react";
import { Play, BookOpenText, Upload } from "lucide-react";
import { assemble } from "@/core/assembler";
import { parseValue } from "@/core/numbers";
import type { Word } from "@/core/types";
import { useSession } from "@/state/sessionStore";
import { useSettings } from "@/state/settingsStore";
import { useMemTypes } from "@/ui/stages/MemoryStage";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/primitives";
import { cn } from "@/lib/utils";

/** Small demo: doubles the data word at address 5 into address 6. */

type LineResult = { word: Word | null; error: boolean; isInstr: boolean };

/**
 * Parse one editor line: an assembly mnemonic via core `assemble()`, or a
 * plain numeric literal (raw data word, parsed in the current display base).
 */
function parseLine(raw: string): LineResult {
  const line = raw.trim();
  if (line === "") return { word: null, error: false, isInstr: false };
  const instr = assemble(line);
  if (instr !== null) return { word: instr, error: false, isInstr: true };
  // Data literal: decimal digits (or base-formatted when the display base
  // is binary / signed decimal).
  const w = parseValue(line, "10") ?? parseValue(line, "2") ?? parseValue(line, "-10");
  if (w !== null) return { word: w, error: false, isInstr: false };
  return { word: null, error: true, isInstr: false };
}

/**
 * Assembly program editor: mono textarea with line numbers, per-line
 * assembly with inline errors, "Load into memory" (fills words 0..n−1 via
 * sessionStore.setMemoryValues, padding with NOP) and "Load & Run" which
 * additionally starts continuous instruction cycles.
 */
export function AsmEditorPanel() {
  const t = useT();
  const features = useSettings((s) => s.features);
  const setMemoryValues = useSession((s) => s.setMemoryValues);
  const setMachine = useSession((s) => s.setMachine);
  const run = useSession((s) => s.run);
  const continueRun = useSession((s) => s.continueRun);

  const [text, setText] = useState("");
  const [loadedCount, setLoadedCount] = useState<number | null>(null);
  const [auto, setAuto] = useState(false);
  const gutterRef = useRef<HTMLPreElement>(null);

  const lines = useMemo(() => text.split("\n"), [text]);
  const results = useMemo(() => lines.map(parseLine), [lines]);
  const errorLines = useMemo(
    () => results.flatMap((r, i) => (r.error ? [i] : [])),
    [results],
  );
  const programWords = useMemo(
    () => results.flatMap((r) => (r.word !== null ? [r.word] : [])),
    [results],
  );
  const hasErrors = errorLines.length > 0;
  const canLoad = features.memory && !hasErrors && programWords.length > 0;

  /* Continuous run for "Load & Run": keep starting instruction cycles while
     the previous one finished without halting. */
  const status = useSession((s) => s.status);
  const timeline = useSession((s) => s.timeline);
  const cursor = useSession((s) => s.cursor);
  useEffect(() => {
    if (!auto) return;
    if (status === "done") {
      const shownHalted = timeline[cursor - 1]?.state.halted ?? false;
      if (shownHalted || timeline.length === 0) setAuto(false);
      else continueRun("instruction"); // append: full-run history
    } else if (status === "halted" || status === "paused" || status === "idle") {
      setAuto(false);
    }
  }, [auto, status, timeline, cursor, run, continueRun]);

  const loadIntoMemory = (): Word[] => {
    const words = [...programWords];
    while (words.length < 32) words.push(0); // NOP = 0x0000
    setMemoryValues(words);
    // QoL: cells that received an instruction switch to instruction display;
    // the rest (data words / NOP padding) reset to Auto.
    useMemTypes.setState((s) => {
      const types = { ...s.types };
      let i = 0;
      for (const r of results) {
        if (r.word === null) continue;
        types[i] = r.isInstr ? "inst" : "auto";
        i++;
      }
      for (; i < 32; i++) types[i] = "auto";
      return { types };
    });
    setLoadedCount(programWords.length);
    return words;
  };

  const onLoad = () => {
    if (!canLoad) return;
    setAuto(false);
    loadIntoMemory();
  };

  const onLoadAndRun = () => {
    if (!canLoad || !features.control) return;
    setAuto(false);
    loadIntoMemory();
    // Fresh program start: PC ← 0, clear latched control state & HALT flag.
    setMachine({ pc: 0, ir: null, microIR: null, halted: false });
    setAuto(true);
    run("instruction");
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2" data-testid="asm-editor">
      {/* Editor: line-number gutter + mono textarea, scroll-synced. */}
      <div className="flex min-h-40 flex-1 overflow-hidden rounded-lg border border-line bg-surface-sunken">
        <pre
          ref={gutterRef}
          aria-hidden
          className="machine-nums select-none overflow-hidden border-r border-line px-2 py-1.5 text-right text-[12px] leading-5 text-ink-faint"
        >
          {lines.map((_, i) => (
            <div
              key={i}
              className={cn(
                results[i]?.error && "rounded bg-accent-danger-soft font-semibold text-accent-danger",
              )}
            >
              {i}
            </div>
          ))}
        </pre>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setLoadedCount(null);
          }}
          onScroll={(e) => {
            if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
          }}
          spellCheck={false}
          aria-label={t("panel.editor.hint")}
          placeholder={t("panel.editor.hint")}
          data-testid="asm-textarea"
          className="machine-nums h-full w-full flex-1 resize-none bg-transparent px-2 py-1.5 text-[12px] leading-5 text-ink outline-none placeholder:text-ink-faint"
        />
      </div>

      {/* Per-line errors. */}
      {hasErrors && (
        <ul data-testid="asm-errors" className="flex flex-col gap-0.5" role="alert">
          <li className="text-[11px] font-semibold uppercase tracking-wide text-accent-danger">
            {t("panel.editor.errors")}
          </li>
          {errorLines.map((n) => (
            <li key={n} className="machine-nums text-[11px] text-accent-danger">
              {t("panel.editor.lineError", { line: n, text: lines[n]?.trim() ?? "" })}
            </li>
          ))}
        </ul>
      )}

      {/* Actions. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="secondary" onClick={onLoad} disabled={!canLoad}>
          <Upload aria-hidden className="h-3.5 w-3.5" />
          {t("panel.editor.load")}
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={onLoadAndRun}
          disabled={!canLoad || !features.control}
          title={features.control ? undefined : t("panel.editor.needsControl")}
        >
          <Play aria-hidden className="h-3.5 w-3.5" />
          {t("panel.editor.loadRun")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          title={t("panel.editor.isatitle")}
          onClick={() => {
            window.open("https://github.com/vittodevit/kands3/blob/main/docs/ISA.md", "_blank");
          }}
        >
          <BookOpenText aria-hidden className="h-3.5 w-3.5" />
          {t("panel.editor.isadoc")}
        </Button>
      </div>

      {/* Contextual hints / confirmation. */}
      <div className="flex flex-col gap-0.5 text-[11px] leading-relaxed text-ink-faint">
        {!features.memory && <p role="note">{t("panel.editor.needsMemory")}</p>}
        {features.memory && !features.control && <p role="note">{t("panel.editor.needsControl")}</p>}
        <p>{t("panel.editor.dataHint")}</p>
        {loadedCount !== null && (
          <p data-testid="asm-loaded" className="text-accent-memory">
            {t("panel.editor.loaded", { count: loadedCount })}
          </p>
        )}
      </div>
    </div>
  );
}
