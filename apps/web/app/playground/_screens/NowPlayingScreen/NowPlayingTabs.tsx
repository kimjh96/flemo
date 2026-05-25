"use client";

import { useStep } from "@flemo/react";

import type { NowPlayingTab } from "./NowPlayingScreen.types";

const tabs: ReadonlyArray<{ key: NowPlayingTab; label: string }> = [
  { key: "player", label: "Player" },
  { key: "queue", label: "Up Next" },
  { key: "lyrics", label: "Lyrics" }
];

export interface NowPlayingTabsProps {
  tab: NowPlayingTab;
}

function NowPlayingTabs({ tab }: NowPlayingTabsProps) {
  const { replaceStep } = useStep<"/now-playing">();

  return (
    <nav
      role="tablist"
      aria-label="Now Playing views"
      className="flex items-center gap-1 self-center rounded-full border border-[var(--color-text-primary)]/15 bg-[var(--color-text-primary)]/5 p-1"
    >
      {tabs.map((t) => {
        const active = t.key === tab;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            data-flemo-step-tab={t.key}
            onClick={() => replaceStep({ tab: t.key })}
            className="rounded-full px-3 py-1 text-[12px] font-semibold transition-colors"
            style={{
              backgroundColor: active ? "var(--color-text-primary)" : "transparent",
              color: active ? "var(--color-bg)" : "var(--color-text-primary)"
            }}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

export default NowPlayingTabs;
