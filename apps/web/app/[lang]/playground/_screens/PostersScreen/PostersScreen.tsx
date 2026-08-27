"use client";

import { Morph, Screen, useNavigate } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import CardShell from "../../_components/CardShell";
import CardTitle from "../../_components/CardTitle";
import TabBar from "../../_components/TabBar";

import { ACTS, artworkFor } from "../../_data/acts";
import { useBench } from "../../_providers/BenchContext";

// The grid, and it exists because the container transform needs one:
//
//   zoom.ts
//     "`shared` moves one element and leaves the screens to their own
//      transition. That is right when the element is one thing among many, and
//      wrong when the element IS the navigation: a grid cell opening into a
//      full-screen view. A grid that stays put underneath reads as the card
//      escaping from it; what the eye expects is that the camera moved to the
//      card, and the rest of the grid went past the edges because it was
//      pushed there."
//
// A row in a list has neighbours above and below it and nothing to either side,
// so a camera zooming into one has little to push anywhere. A cell in a grid
// has neighbours on four sides, and they are what leaves through the edges.
//
// It is a PEER of the other two tabs rather than a mode of the list, so no
// screen here branches on which case the bench has selected. The same acts, the
// same `layoutId`s, the same detail screen on the other end: only the
// arrangement differs, which is exactly the variable the container transform
// cares about.
function PostersScreen() {
  const { push } = useNavigate();
  const { transition, morph } = useBench();
  const t = getDict(useShellLang()).playground;

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
            {t.app.tabPosters}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--color-text-disabled)]">{t.app.postersNote}</p>
        </header>

        <ul className="grid min-h-0 flex-1 grid-cols-2 content-start gap-3 overflow-y-auto px-4 pb-3">
          {ACTS.map((act) => (
            <li key={act.id}>
              <button
                type="button"
                onClick={() =>
                  push(
                    "/tonight/act/:id",
                    { id: act.id, from: "cell" },
                    { transitionName: transition }
                  )
                }
                className="w-full cursor-pointer text-left"
              >
                {/* THE CARD is what flies under the container transform: the
                    cell becomes the page rather than a square escaping from
                    it. Under every other case this is a plain box. */}
                <CardShell
                  layoutId={`card-${act.id}`}
                  className="block overflow-hidden rounded-2xl bg-[var(--color-layer)] p-2"
                >
                  <Morph
                    as="span"
                    // Scoped to THIS surface, not shared with the list tab. Both
                    // tabs show the same acts, so one id across both would pair
                    // all ten whenever the two tabs are in a flight together.
                    // The detail is the big side for either, and is told which
                    // one opened it through the route.
                    name={morph}
                    layoutId={`cell-${act.id}`}
                    className="block aspect-square w-full rounded-xl"
                    style={{ background: artworkFor(act.hue) }}
                    aria-hidden="true"
                  />
                  <CardTitle
                    layoutId={`cardname-${act.id}`}
                    className="mt-2 block truncate px-0.5 text-[13px] font-semibold text-[var(--color-text-primary)]"
                  >
                    {act.artist}
                  </CardTitle>
                  <span className="mt-0.5 block truncate px-0.5 pb-0.5 text-[11px] text-[var(--color-text-disabled)]">
                    {act.day} {act.time} · ₩{act.price}
                  </span>
                </CardShell>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Screen>
  );
}

export default PostersScreen;
