"use client";

import StageScreen from "../../_components/StageScreen";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import TabBar from "../../_components/TabBar";

import { PIECES, surfaceFor } from "../../_data/gallery";

// The other tab, and the reason the tab bar is worth looking at: it declares
// the SAME `sharedBottomBarId` as the Browse tab, so switching between them
// leaves the bar exactly where it is while the content behind it cross-fades.
// A bar rendered inside each screen would fade with them.
//
// It is a plain list on purpose. One tab holds a nested Router and the other
// holds nothing, which is the honest pair: the bar does not care.
function SavedTab() {
  const t = getDict(useShellLang()).playground.app;

  return (
    <StageScreen
      backgroundColor="var(--color-bg)"
      sharedBottomBarId="tabs"
      sharedBottomBar={<TabBar />}
    >
      <div className="h-full overflow-y-auto px-5 py-5">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">
          {t.saved}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-disabled)]">
          {t.savedHint}
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {PIECES.slice(0, 4).map((piece) => (
            <li
              key={piece.id}
              className="flex items-center gap-3 rounded-2xl bg-[var(--color-layer)] p-2"
            >
              <span
                className="block size-12 shrink-0 rounded-xl"
                style={{ background: surfaceFor(piece.hue) }}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">
                  {piece.title}
                </span>
                <span className="block truncate text-xs text-[var(--color-text-disabled)]">
                  {piece.place}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </StageScreen>
  );
}

export default SavedTab;
