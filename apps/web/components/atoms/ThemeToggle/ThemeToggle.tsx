"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { THEME_LABEL, THEME_ORDER, type ThemeKind } from "./ThemeToggle.constants";
import ThemeToggleIcon from "./ThemeToggleIcon";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <span className="inline-block size-9" aria-hidden />;
  }

  const current: ThemeKind = THEME_ORDER.includes(theme as ThemeKind)
    ? (theme as ThemeKind)
    : "system";
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
