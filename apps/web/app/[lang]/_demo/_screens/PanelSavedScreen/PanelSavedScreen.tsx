"use client";

import { useState } from "react";

import { Screen, useNavigate } from "@flemo/react";

import Icon from "@/components/Icon";
import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";

import MiniArtwork from "../../_components/MiniArtwork";
import TripMenu from "../../_components/TripMenu";
import type { PlaceId } from "../../_data/places";

const SAVED: PlaceId[] = ["lisbon", "oaxaca", "reykjavik"];

// The panel's first page. Two Routers are in reach from here: `useNavigate()`
// is the panel's, so Filter moves only the panel, and the app's is named, so a
// saved place opens over the whole app. The menu is a Layer: opened from this
// nested screen, it is drawn above the app's header.
function PanelSavedScreen() {
  const panel = useNavigate();
  const app = useNavigate({ router: "trip" });
  const [menuOpen, setMenuOpen] = useState(false);
  const t = useShellDict().mini;

  return (
    <Screen
      statusBarHeight="0px"
      systemNavigationBarHeight="0px"
      backgroundColor="var(--surface)"
      contentScrollable={false}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-line pr-1.5 pl-3">
          <span className="text-xs font-semibold text-fg">{t.trip.saved}</span>
          <span className="flex items-center">
            <button
              type="button"
              onClick={() => panel.push("/panel/filters", {})}
              className="flex h-7 items-center gap-1 rounded-full px-2 text-xs text-fg-muted transition-colors hover:bg-surface-2"
            >
              <Icon name="sliders" size={14} />
              {t.trip.filter}
            </button>
            <button
              type="button"
              aria-label={t.trip.more}
              onClick={() => setMenuOpen(true)}
              className="grid size-7 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-2"
            >
              <Icon name="more" size={16} />
            </button>
          </span>
        </div>
        <ul className="flex flex-col p-1">
          {SAVED.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => app.push("/trip/:id", { id })}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
              >
                <MiniArtwork place={id} className="size-8 shrink-0 rounded-md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-fg">{t.places[id]}</span>
                  <span className="block truncate text-[0.6875rem] text-fg-subtle">
                    {t.countries[id]}
                  </span>
                </span>
                <Icon name="chevronRight" size={13} className="text-fg-subtle" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      {menuOpen && <TripMenu onClose={() => setMenuOpen(false)} />}
    </Screen>
  );
}

export default PanelSavedScreen;
