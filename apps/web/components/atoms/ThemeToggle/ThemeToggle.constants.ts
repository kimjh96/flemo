export const THEME_ORDER = ["system", "light", "dark"] as const;

export type ThemeKind = (typeof THEME_ORDER)[number];

export const THEME_LABEL: Record<ThemeKind, string> = {
  system: "시스템 설정 따름",
  light: "라이트 모드",
  dark: "다크 모드"
};

// Mirrors the theme setting so the server can read it (next-themes only writes
// localStorage) and render the matching toggle icon on first paint, with no
// mount flicker.
export const THEME_COOKIE = "flemo-theme";

export function normalizeTheme(value: string | undefined): ThemeKind {
  return THEME_ORDER.includes(value as ThemeKind) ? (value as ThemeKind) : "system";
}
