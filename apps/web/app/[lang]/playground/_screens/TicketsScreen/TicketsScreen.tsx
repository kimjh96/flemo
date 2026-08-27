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
  const past = ACTS.slice(2, 5);

  return (
    <Screen
      statusBarHeight="0px"
      systemNavigationBarHeight="0px"
      backgroundColor="var(--color-bg)"
      sharedBottomBar={<TabBar />}
    >
      <div className="flex h-full flex-col">
        <header className="shrink-0 px-5 pt-6 pb-3">
          <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">
            {t.app.tabTickets}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--color-text-disabled)]">{t.app.ticketsNote}</p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {/* A held ticket is a card with a stub, because the dashed outline an
              earlier version used reads as a skeleton waiting for data rather
              than as a ticket. */}
          <ul className="flex flex-col gap-3">
            {held.map((act) => (
              <li
                key={act.id}
                className="overflow-hidden rounded-2xl bg-[var(--color-layer)] shadow-sm"
              >
                <div className="flex items-center gap-3 px-3.5 py-3">
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
                  <span className="shrink-0 rounded-full bg-[var(--color-primary)]/15 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-primary)]">
                    {t.app.held}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-dashed border-[var(--color-border)] px-3.5 py-2.5 text-[11px]">
                  <span className="tracking-[0.08em] text-[var(--color-text-disabled)] uppercase">
                    {t.app.order} {act.order}
                  </span>
                  <span className="font-semibold text-[var(--color-text-secondary)]">
                    ₩{act.price}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <h3 className="mt-6 mb-2 px-1 text-[11px] font-bold tracking-[0.12em] text-[var(--color-text-disabled)] uppercase">
            {t.app.past}
          </h3>
          <ul className="flex flex-col gap-1">
            {past.map((act) => (
              <li key={act.id} className="flex items-center gap-3 px-1 py-2 opacity-55">
                <span
                  className="size-9 shrink-0 rounded-lg"
                  style={{ background: artworkFor(act.hue) }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
                    {act.artist}
                  </span>
                  <span className="block truncate text-[11px] text-[var(--color-text-disabled)]">
                    {act.venue} · {act.day} {act.time}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-[var(--color-text-disabled)]">
                  {t.app.used}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Screen>
  );
}

export default TicketsScreen;
