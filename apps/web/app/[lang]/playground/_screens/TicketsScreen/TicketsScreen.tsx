"use client";

import { Screen } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import TabBar from "../../_components/TabBar";

import { ACTS, artworkFor } from "../../_data/acts";

// The peer tab. It declares the SAME shared bar as the list, so the bar holds
// still while the two tabs move laterally under it: the other half of the
// ride-or-hold rule the detail screen exercises.
//
// Nothing is paired here: no flight starts from this list, so its artwork is a
// plain span. A <Morph> with no partner on the other side is not a shared
// element, it is a promise flemo cannot keep.
function TicketsScreen() {
  const t = getDict(useShellLang()).playground;
  const held = ACTS.slice(0, 2);

  return (
    <Screen
      statusBarHeight="0px"
      systemNavigationBarHeight="0px"
      backgroundColor="var(--color-bg)"
      sharedBottomBar={<TabBar />}
    >
      <div className="flex h-full flex-col">
        <header className="px-5 pt-6 pb-3">
          <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">
            {t.app.tabTickets}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--color-text-disabled)]">{t.app.ticketsNote}</p>
        </header>

        <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {held.map((act) => (
            <li
              key={act.id}
              className="mb-2 flex items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] px-3 py-2.5"
            >
              <span
                className="size-12 shrink-0 rounded-xl"
                style={{ background: artworkFor(act.hue) }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">
                  {act.artist}
                </span>
                <span className="block truncate text-xs text-[var(--color-text-disabled)]">
                  {act.venue} · {act.day} {act.time}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-[var(--color-layer)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                {t.app.held}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Screen>
  );
}

export default TicketsScreen;
