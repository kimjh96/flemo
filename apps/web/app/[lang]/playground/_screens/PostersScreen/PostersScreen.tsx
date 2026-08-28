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
                // `block`, because a <button> is inline-block by default and
                // its line box then adds the strut's descender under the card
                // inside it. Measured: the card's own box was 207px while the
                // cell holding it was 214px, so a flight that starts from the
                // card's box starts 7px SHORTER than the cell it left, which is
                // the card appearing to shrink before it grows. `attachMorph`
                // records the same 6.31px on WebKit for the same reason.
                className="block w-full cursor-pointer text-left"
              >
                {/* THE CARD is what flies under the container transform: the
                    cell becomes the page rather than a square escaping from
                    it. Under every other case this is a plain box. */}
                <CardShell
                  layoutId={`card-${act.id}`}
                  className="block overflow-hidden rounded-2xl bg-[var(--color-layer)]"
                >
                  {/* THE BOX IS THE WRAPPER'S, not the morph's.
                      
                      A morph leaves a stand-in in its place for the flight, and
                      that stand-in is sized to the element in flight, not to
                      the element at rest: measured on a pop, the cell's artwork
                      reported 241px inside a 151px cell and the caption under
                      it was pushed 15px down until the flight landed. Holding
                      the square here, and clipping, means nothing the flight
                      does can move the two lines below. */}
                  <span className="block aspect-square w-full overflow-hidden">
                    <Morph
                      as="span"
                      // Scoped to THIS surface, not shared with the list tab. Both
                      // tabs show the same acts, so one id across both would pair
                      // all ten whenever the two tabs are in a flight together.
                      // The detail is the big side for either, and is told which
                      // one opened it through the route.
                      name={morph}
                      layoutId={`cell-${act.id}`}
                      className="block size-full"
                      style={{ background: artworkFor(act.hue) }}
                      aria-hidden="true"
                    />
                  </span>
                  {/* The caption runs the same part as the detail's copy, so
                      both ends of the card are bare while it travels. A
                      caption here and none there is a line of type appearing
                      out of nothing partway through the flight, which is the
                      shift between the title and the date that a recording
                      kept showing. */}
                  {/* Visible for the whole flight, dissolving inside the
                      card's ghost, as the deleted playground's caption did.
                      Only the NAME is paired: it re-typesets into the detail's
                      heading while its clone holds this exact box. */}
                  {/* The fixed-height holder does for the name what the fixed
                      square does for the artwork. A morph's slot measures 0x0
                      while the element is away, so without a box of its own the
                      line collapses in the flying card and everything below it
                      sits a line too high, then drops at the landing. */}
                  <span className="mt-2 block h-5">
                    <CardTitle
                      layoutId={`cardname-${act.id}`}
                      className="block truncate px-2.5 text-[13px] font-semibold text-[var(--color-text-primary)]"
                    >
                      {act.artist}
                    </CardTitle>
                  </span>
                  <span className="mt-0.5 block truncate px-2.5 pb-2.5 text-[11px] text-[var(--color-text-disabled)]">
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
