"use client";

import { Part } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import AppBar from "../../_components/AppBar";
import Poster from "../../_components/Poster";
import StageScreen from "../../_components/StageScreen";
import TabBar from "../../_components/TabBar";

import { useMotionChoice } from "../../_providers/MotionChoiceContext";

import { ACTS } from "../../_data/tonight";

// The other tab. It holds no Router of its own, and the tab bar does not care:
// the same shared id means the bar stays exactly where it is while the content
// behind it changes.
//
// Its bar is the same shared id as the Home tab's, so switching tabs hands the
// TITLE over inside a box that never moves — which is the tab-switch version of
// the same hand-over a push does, and worth being able to see beside it.
function TicketsScreen() {
  const t = getDict(useShellLang()).playground;
  const { barPart, bodyPart } = useMotionChoice();
  const held = ACTS.slice(0, 2);

  return (
    <StageScreen
      backgroundColor="var(--color-bg)"
      sharedTopBarId="app"
      sharedTopBar={<AppBar part={barPart} title={t.app.tickets} />}
      sharedBottomBar={<TabBar />}
      sharedBottomBarId="tabs"
    >
      <div className="h-full overflow-y-auto px-4 pt-3 pb-8">
        <ul className="flex flex-col gap-2">
          {held.map((act) => (
            <li key={act.id}>
              <Part name={bodyPart}>
                <span className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] p-2.5">
                  <Poster act={act} place="thumb" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[var(--color-text-primary)]">
                      {act.artist}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--color-text-secondary)]">
                      {act.venue} · {act.day} {act.time}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-[var(--color-layer)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                    {t.app.ticketHeld}
                  </span>
                </span>
              </Part>
            </li>
          ))}
        </ul>

        <Part name={bodyPart} className="mt-4">
          <p className="text-[13px] leading-relaxed text-[var(--color-text-disabled)]">
            {t.app.ticketsNote}
          </p>
        </Part>
      </div>
    </StageScreen>
  );
}

export default TicketsScreen;
