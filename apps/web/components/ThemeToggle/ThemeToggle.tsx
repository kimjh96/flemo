"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import Icon, { type IconName } from "@/components/Icon";

import { useInitialTheme } from "./InitialThemeProvider";
import { THEME_COOKIE, THEME_LABEL, THEME_ORDER, type ThemeKind } from "./ThemeToggle.constants";

const ICON: Record<ThemeKind, IconName> = { system: "monitor", light: "sun", dark: "moon" };

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Seeded from the cookie the server read, so the first client render draws the
  // same icon the server did. No mount gate, so no flicker and no mismatch.
  const initialTheme = useInitialTheme();
  const [current, setCurrent] = useState<ThemeKind>(initialTheme);

  // Mirror next-themes' setting (it lives in localStorage) into the icon state
  // and the SSR-readable cookie. Runs on mount too, so a returning visitor whose
  // cookie was absent or stale converges and the next server render is correct.
  useEffect(() => {
    if (!theme || !THEME_ORDER.includes(theme as ThemeKind)) return;
    const resolved = theme as ThemeKind;
    setCurrent(resolved);
    document.cookie = `${THEME_COOKIE}=${resolved}; path=/; max-age=31536000; samesite=lax`;
  }, [theme]);

  const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length]!;

  return (
    <button
      type="button"
      aria-label={`Theme: ${THEME_LABEL[current]}. Switch to ${THEME_LABEL[next]}.`}
      title={`Theme: ${THEME_LABEL[current]}`}
      onClick={() => setTheme(next)}
      className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
    >
      <Icon name={ICON[current]} size={16} />
    </button>
  );
}

export default ThemeToggle;
