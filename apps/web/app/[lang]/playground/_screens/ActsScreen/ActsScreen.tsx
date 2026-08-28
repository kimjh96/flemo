"use client";

import { Morph, Screen, useNavigate } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import CardShell from "../../_components/CardShell";
import CardTitle from "../../_components/CardTitle";
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
// accident. see `computeBarRiding`.
function ActsScreen() {
  const { push } = useNavigate();
  const { transition, morph } = useBench();
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
        <header className="shrink-0 px-5 pt-6 pb-3">
          <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">
            {t.app.title}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--color-text-disabled)]">{t.app.subtitle}</p>
        </header>

        {/* The shared bar STACKS below this list rather than covering it: the
            list's bottom edge and the bar's top edge measure to the same y on
            the running build. So the padding here is breathing room, not
            clearance, and a row clipped at the edge is the scroller working. */}
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {ACTS.map((act) => (
            <li key={act.id}>
              <button
                type="button"
                onClick={() =>
                  push(
                    "/tonight/act/:id",
                    { id: act.id, from: "row" },
                    { transitionName: transition }
                  )
                }
                className="block w-full cursor-pointer rounded-2xl text-left transition-colors hover:bg-[var(--color-layer)]"
              >
                {/* THE ROW IS A CONTAINER TOO. The container transform's pair
                    and camera live on CardShell, and until the row drew one,
                    zoom from this tab flew a lone artwork over a plain fade:
                    no card, no camera. The id is surface-scoped (rowcard-, not
                    card-) so the two tabs never pair with each other while a
                    tab switch has both mounted. */}
                <CardShell
                  layoutId={`rowcard-${act.id}`}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5"
                >
                  {/* The fixed square holds the thumb's box in the row for the
                      same reason the detail's aspect-square span holds the
                      hero's: a nested morph animates its BOX, and laid bare in
                      this flex row that animated box IS layout. Measured on a
                      pop: the arriving thumb staged at detail size (390px wide)
                      squeezed the label's flex-1 slot to width 0, the label's
                      own flight DECLINED on that measurement (zero-destination
                      in the morph trace), and the title just grew back in from
                      the right with the reflow instead of re-typesetting home
                      along the push's path. Held, the row never feels the
                      thumb's flight. */}
                  <span className="block size-12 shrink-0">
                    <Morph
                      as="span"
                      // The SMALL side. `zoom` puts its camera on whichever screen
                      // the element is small on, so on a push this list is what
                      // gets pushed past the edges, and on a pop the same zoom runs
                      // backwards. Both sides of a pair must name the same morph.
                      //
                      // The id is scoped to THIS surface. The posters tab shows the
                      // same acts, and when the two tabs are in a flight together
                      // one shared id would pair all ten of them: measured at 50
                      // morph animations on a single tab switch, which is load this
                      // stage manufactures for nothing.
                      name={morph}
                      layoutId={`row-${act.id}`}
                      className="block size-full rounded-xl"
                      style={{ background: artworkFor(act.hue) }}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    {/* Paired like the grid's title, under this surface's own
                      id, in a fixed-height holder. */}
                    <span className="block h-5">
                      <CardTitle
                        layoutId={`rowname-${act.id}`}
                        className="block truncate text-sm leading-5 font-semibold text-[var(--color-text-primary)]"
                      >
                        {act.artist}
                      </CardTitle>
                    </span>
                    <span className="block truncate text-xs text-[var(--color-text-disabled)]">
                      {act.venue} · {act.day} {act.time}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs font-semibold text-[var(--color-text-secondary)] tabular-nums">
                    ₩{act.price}
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

export default ActsScreen;
