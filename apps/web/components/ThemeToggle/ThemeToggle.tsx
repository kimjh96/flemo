"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const ORDER = ["system", "light", "dark"] as const;

const LABEL: Record<(typeof ORDER)[number], string> = {
  system: "시스템 설정 따름",
  light: "라이트 모드",
  dark: "다크 모드"
};

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <span className="inline-block size-9" aria-hidden />;
  }

  const current = (
    ORDER.includes(theme as (typeof ORDER)[number]) ? theme : "system"
  ) as (typeof ORDER)[number];
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];

  return (
    <button
      type="button"
      aria-label={`Theme: ${LABEL[current]}. Click for ${LABEL[next]}.`}
      title={LABEL[current]}
      onClick={() => setTheme(next)}
      className="inline-flex size-9 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-neutral-200)] hover:text-[var(--color-text-primary)]"
    >
      {current === "system" ? <Monitor /> : current === "light" ? <Sun /> : <Moon />}
    </button>
  );
}

function Sun() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v1.5" />
      <path d="M12 19.5V21" />
      <path d="M3 12h1.5" />
      <path d="M19.5 12H21" />
      <path d="M5.4 5.4l1.06 1.06" />
      <path d="M17.54 17.54l1.06 1.06" />
      <path d="M5.4 18.6l1.06-1.06" />
      <path d="M17.54 6.46l1.06-1.06" />
    </svg>
  );
}

function Moon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function Monitor() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}
