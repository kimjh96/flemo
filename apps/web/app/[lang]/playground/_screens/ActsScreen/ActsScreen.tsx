"use client";

import { Morph, Screen, useNavigate } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import TabBar from "../../_components/TabBar";

import { ACTS, artworkFor } from "../../_data/acts";
import { useBench } from "../../_providers/BenchContext";

// The list. Modelled directly on the library author's own music demo, which is
// the smallest correct shared-element setup in this repository:
//
//   MusicLibraryScreen.tsx
//     "that track's artwork is a <Morph>: it is the same square as the cover on
//      the other side, so it grows into place as the sheet arrives instead of
//      being cut at the boundary. Nothing about the screen or the transition
//      changes to allow it."
//
// So: ONE paired element, the SAME SHAPE at both ends, and nothing about the
// screen or the transition altered to accommodate it. An earlier version of
// this page paired three things (the row, the artwork and the title) across two
// different layouts, which is what the Morph docs call "letting both fly on
// their own curves ... what tears a card apart mid-flight".
//
// It declares the tab bar; the detail screen declares none, so the bar rides
// out with this screen and back on the pop. That is the wallet demo's
// "shared-bar present/absent transition", used on purpose rather than by
// accident — see `computeBarRiding`.
function ActsScreen() {
  const { push } = useNavigate();
  const { transition } = useBench();
  const t = getDict(useShellLang()).playground;

  return (
    <Screen
      // Not a device: zero the chrome insets so the bar anchors to the bottom
      // of the stage region rather than to a status bar that is not there.
      statusBarHeight="0px"
      systemNavigationBarHeight="0px"
      backgroundColor="var(--color-bg)"
      sharedBottomBar={<TabBar />}
    >
      <div className="flex h-full flex-col">
        <header className="px-5 pt-6 pb-3">
          <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">
            {t.app.title}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--color-text-disabled)]">{t.app.subtitle}</p>
        </header>

        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {ACTS.map((act) => (
            <li key={act.id}>
              <button
                type="button"
                onClick={() =>
                  push("/tonight/act/:id", { id: act.id }, { transitionName: transition })
                }
                className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-layer)]"
              >
                <Morph
                  as="span"
                  layoutId={`art-${act.id}`}
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
                <span className="shrink-0 font-mono text-xs font-semibold text-[var(--color-text-secondary)] tabular-nums">
                  ₩{act.price}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Screen>
  );
}

export default ActsScreen;
