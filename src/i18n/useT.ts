import en from "./en.json";

/**
 * Lightweight i18n layer. All UI strings flow through `t(key, vars)` so a
 * second locale can be swapped in later without touching components.
 *
 * Interpolation: `"topbar.theme.next": "current: {{theme}}"` +
 * `t("topbar.theme.next", { theme: "dark" })` → `"current: dark"`.
 */

export type TranslationKey = keyof typeof en & string;
type Vars = Record<string, string | number>;

export function translate(key: TranslationKey, vars?: Vars): string {
  const template = en[key] as string | undefined;
  if (template === undefined) return key;
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Hook form — kept for future reactive locale switches. */
export function useT(): (key: TranslationKey, vars?: Vars) => string {
  return translate;
}
