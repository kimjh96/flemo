"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { useInitialTheme } from "./InitialThemeProvider";
import { THEME_COOKIE, THEME_LABEL, THEME_ORDER, type ThemeKind } from "./ThemeToggle.constants";
import ThemeToggleIcon from "./ThemeToggleIcon";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Seeded from the cookie the server read, so the first client render draws the
  // same icon the server did. No mount gate, so no flicker and no mismatch.
  const initialTheme = useInitialTheme();
  const [current, setCurrent] = useState<ThemeKind>(initialTheme);

  // Mirror next-themes' setting (it lives in localStorage) into the icon state
  // and the SSR-readable cookie. Runs on mount too, so a returning user whose
  // cookie was absent or stale converges and the next server render is correct.
  useEffect(() => {
    if (!theme || !THEME_ORDER.includes(theme as ThemeKind)) return;
    const resolved = theme as ThemeKind;
    setCurrent(resolved);
    document.cookie = `${THEME_COOKIE}=${resolved}; path=/; max-age=31536000; samesite=lax`;
  }, [theme]);

  const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length]!;
  const handleClick = () => setTheme(next);

  return (
    <button
      type="button"
      aria-label={`Theme: ${THEME_LABEL[current]}. Click for ${THEME_LABEL[next]}.`}
      title={THEME_LABEL[current]}
      onClick={handleClick}
      className="inline-flex size-9 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-neutral-200)] hover:text-[var(--color-text-primary)]"
    >
      <ThemeToggleIcon kind={current} />
    </button>
  );
}

export default ThemeToggle;
