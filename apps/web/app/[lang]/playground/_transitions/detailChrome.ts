"use client";

import { createRawPartTransition, type PartTransitionName } from "@flemo/react";

import { DRIFT_IN } from "./drift.constants";

import "./detailChrome.types";

// The detail's floating header, on every case where the CARD IS NOT FLYING.
//
// Under those cases the artwork still flies alone, and the flight layer paints
// above the whole screen — including the z-10 header that overlays the
// artwork's top edge. So for the length of the flight the header is COVERED by
// the flying artwork, and the instant the flight lands it is revealed whole:
// scrim, back control and title in one frame. That is the "flash after
// arriving" reported on fade-through, and it is latent in every case whose
// flight ends on the screen's own last frame.
//
// The remedy is the deleted playground's, recorded in its clocks.ts: chrome
// that cannot ride a flight carries the flight's clock itself, and THE CLOCK
// IS PER TRANSITION AND PER DIRECTION — its table kept one row per name and
// split push from pop after measuring material's 0.35s parts running over a
// 0.25s pop. A part authors literal durations, so one part cannot fit flights
// from 0s (`none`) to 0.7s (cupertino); this factory writes one per case
// instead, and `CardBody` picks by the bench's transition.
//
// Each one holds the header back for exactly the flight's length, then fades
// it in just after the landing: the reveal happens while the header is still
// transparent, so what was a slam is an entrance. `none` has a zero flight —
// nothing ever covers the header — so its chrome is immediate, which the
// reference's table states as a rule: "a cut is not a degenerate case to
// special-case away."
//
// The pop direction needs no delay anywhere: the artwork leaves the detail at
// the tap, nothing covers the header, and the header's job is to ride the
// dismissing screen out — REST, in every row.
// 0.18s read as a blink: the page settles at the flight's end and a dark
// scrim then materialised in under a fifth of a second — reported as
// "flicker right after arriving" on fade-through. A third of a second reads
// as the header settling into place instead.
const IN = 0.32;
const EASE_IN: [number, number, number, number] = [0, 0, 0.2, 1];

const SHOWN = { opacity: 1 };
const HIDDEN = { opacity: 0 };
const REST = { value: SHOWN, options: { duration: 0 } };

// Push-side flight lengths, copied from each transition's own constants the
// way the reference copied flemo's: cupertino/material/layout from the
// presets' documented numbers, the authored three from their source files
// beside this one (fade-through's flight spans its OUT delay plus its IN).
const COVER: Record<string, number> = {
  cupertino: 0.7,
  material: 0.35,
  layout: 0.4,
  none: 0,
  reveal: 0.34,
  drift: DRIFT_IN,
  "fade-through": 0.45
};

export const chromePartFor = (transition: string): PartTransitionName =>
  `chrome-${transition}` as PartTransitionName;

const arrival = (cover: number) =>
  cover === 0 ? REST : { value: SHOWN, options: { duration: IN, delay: cover, ease: EASE_IN } };

const detailChromes = Object.entries(COVER).map(([name, cover]) =>
  createRawPartTransition({
    name: chromePartFor(name),
    initial: cover === 0 ? SHOWN : HIDDEN,
    idle: REST,
    pushOnEnter: arrival(cover),
    pushOnExit: REST,
    replaceOnEnter: arrival(cover),
    replaceOnExit: REST,
    popOnEnter: REST,
    popOnExit: REST,
    completedOnEnter: REST,
    completedOnExit: REST
  })
);

export default detailChromes;
