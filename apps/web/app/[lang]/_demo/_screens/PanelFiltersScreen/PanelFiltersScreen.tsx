"use client";

import { useState } from "react";

import { Screen, useNavigate } from "@flemo/react";

import Icon from "@/components/Icon";
import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";

// The panel's second page. Pushed on the panel's own Router, so only the panel
// moves, and its back button pops only the panel.
function PanelFiltersScreen() {
  const { pop } = useNavigate();
  const t = useShellDict().mini;
  const [picked, setPicked] = useState(0);

  return (
    <Screen
      statusBarHeight="0px"
      systemNavigationBarHeight="0px"
      backgroundColor="var(--surface)"
      contentScrollable={false}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line px-1.5">
          <button
            type="button"
            aria-label={t.back}
            onClick={() => pop()}
            className="grid size-7 place-items-center rounded-full text-fg transition-colors hover:bg-surface-2"
          >
            <Icon name="arrowLeft" size={15} />
          </button>
          <span className="text-xs font-semibold text-fg">{t.trip.filters}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 p-3">
          {t.trip.filterOptions.map((option, index) => (
            <button
              key={option}
              type="button"
              onClick={() => setPicked(index)}
              className={`h-7 rounded-full border px-3 text-xs transition-colors ${
                index === picked
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line text-fg-muted hover:bg-surface-2"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </Screen>
  );
}

export default PanelFiltersScreen;
