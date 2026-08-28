"use client";

import { Morph, Screen, useNavigate, useParams } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import CardShell from "../../_components/CardShell";
import CardTitle from "../../_components/CardTitle";

import { actById, artworkFor } from "../../_data/acts";
import { useBench } from "../../_providers/BenchContext";

// The detail: the big side of the grid cell's pair.
//
// ITS LAYOUT IS THE CELL'S LAYOUT CONTINUED, and that constraint decided
// everything here. A container transform lays this page out at the flying
// card's CURRENT width on every frame, so whatever this page does at 150px
// wide is what shows through as the card's ghost dissolves. One column,
// artwork first and full-width, everything else in flow below it: at cell
// size that renders exactly what the cell renders (a full square with text
// clipped below), so the gradient is never smaller than the square it left.
//
// An earlier shape had a fixed buy-bar as a flex sibling stealing ~90px from
// the scroller. At cell size the scroller was 117px tall and CLIPPED the
// arriving artwork to 151x117: the gradient showed up SMALLER than the square
// it left and then grew, across three recordings. Chrome that must not steal
// height floats absolutely (the header); everything else scrolls in flow,
// which is the deleted playground's structure.
//
// No part transitions in the card. The card's ghost (crossFade 0.55) covers
// the narrow-width phase of this layout by itself, which is how the deleted
// playground shipped it.
function ActScreen() {
  const navigate = useNavigate();
  const params = useParams<"/tonight/act/:id">();
  const act = actById(params?.id);
  const t = getDict(useShellLang()).playground;
  const { morph, cardMorph } = useBench();

  if (!act) return null;

  // Reaching past the top in one transition. `until` collapses the list as
  // well as this screen, so the stack lands on the tickets tab alone:
  //
  //   createNavigationController.ts
  //     "replace: replaces it; the target and everything above become the new
  //      screen"
  const getTickets = () => navigate.replace("/tonight/tickets", {}, { until: "/tonight" });

  const facts: [string, string][] = [
    [t.app.doors, `${act.day} ${act.time}`],
    [t.app.venue, act.venue],
    [t.app.age, t.app.ageValue]
  ];

  return (
    <Screen
      statusBarHeight="0px"
      systemNavigationBarHeight="0px"
      // WHOEVER OWNS THE SURFACE PAINTS IT. Under the container transform the
      // CARD is the surface: opaque, filling this screen at rest, and the
      // thing that grows. A background here as well would paint a full-size
      // opaque rectangle over the grid from the first frame, covering the
      // camera's own work. Under every other case this screen is the surface
      // and must be opaque itself.
      backgroundColor={cardMorph ? "transparent" : "var(--color-bg)"}
    >
      {/* The scroller sits OUTSIDE the card, and the card is min-h-full inside
          it, exactly as the deleted playground arranged it: the card is a
          single column of content that clips at its box, not a box with its
          own internal chrome layout. */}
      <div className="h-full overflow-y-auto">
        <CardShell
          layoutId={params?.from === "cell" ? `card-${act.id}` : null}
          className="relative flex min-h-full flex-col bg-[var(--color-bg)]"
        >
          {/* Floating, so it adds no height above the artwork: both ends of
              the pair start with the artwork at y0, and a 52px offset here
              was once every symptom at once (flicker, shift, vanishing
              header). The scrim keeps it legible on the gradient. */}
          <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/45 to-transparent px-4 pt-4 pb-8">
            <button
              type="button"
              onClick={() => navigate.pop()}
              aria-label={t.app.back}
              className="grid size-9 cursor-pointer place-items-center rounded-full text-white transition-colors hover:bg-white/15"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M15 6l-6 6 6 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <span className="text-xs font-bold tracking-[0.12em] text-white/70 uppercase">
              {t.app.detail}
            </span>
            <span className="size-9" aria-hidden="true" />
          </header>

          {/* The fixed square holds the artwork's box while the artwork
              itself is away in the flight layer, so nothing below it moves. */}
          <span className="block aspect-square w-full shrink-0 overflow-hidden">
            <Morph
              // The BIG side: same morph, same id as the surface that opened
              // this screen. The list scopes its ids to rows and the grid to
              // cells, and which one to answer to arrives on the route.
              name={morph}
              layoutId={`${params?.from ?? "row"}-${act.id}`}
              className="block size-full"
              style={{ background: artworkFor(act.hue) }}
              aria-hidden="true"
            />
          </span>

          <div className="px-5 pt-4 pb-8">
            {/* Paired as a `text` morph, as the deleted playground paired it:
                lifted out of both sides, re-typesetting from the cell's 13px
                label into this heading, while its clone holds the label's
                exact box. */}
            {/* h-8 holds the heading's line box while the name is away in the
                flight layer, for the same reason the artwork sits in a fixed
                square: the morph slot measures 0x0 mid-flight, and an unheld
                line collapses the layout under it until the landing. */}
            <h2 className="h-8">
              <CardTitle
                layoutId={params?.from === "cell" ? `cardname-${act.id}` : null}
                className="block text-2xl font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]"
              >
                {act.artist}
              </CardTitle>
            </h2>
            {/* The SAME string as the cell's meta, paired as the same text
                morph, in a fixed-height holder: one line re-typesetting from
                11px to 14px instead of two different date lines cross-fading
                on top of each other. The venue is not lost; it has its own row
                in the facts below. */}
            <p className="mt-1 h-5">
              <CardTitle
                layoutId={params?.from === "cell" ? `cardmeta-${act.id}` : null}
                className="block text-sm text-[var(--color-text-secondary)]"
              >
                {act.day} {act.time} · ₩{act.price}
              </CardTitle>
            </p>

            <p className="mt-4 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
              {t.app.body}
            </p>

            <dl className="mt-5 flex flex-col gap-2 rounded-2xl bg-[var(--color-layer)] p-4 text-[13px]">
              {facts.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3">
                  <dt className="text-[var(--color-text-disabled)]">{label}</dt>
                  <dd className="m-0 font-semibold text-[var(--color-text-primary)]">{value}</dd>
                </div>
              ))}
            </dl>

            {/* In flow at the end of the content, as the deleted playground
                placed its buy control. A fixed footer stole its height from
                the scroller, and at cell width that clipped the arriving
                artwork below its own square. */}
            <button
              type="button"
              onClick={getTickets}
              className="mt-6 w-full cursor-pointer rounded-full bg-[var(--color-primary)] px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
            >
              {t.app.getTickets} · ₩{act.price}
            </button>
          </div>
        </CardShell>
      </div>
    </Screen>
  );
}

export default ActScreen;
