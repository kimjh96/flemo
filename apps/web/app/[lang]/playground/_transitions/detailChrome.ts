"use client";

import { createRawPartTransition } from "@flemo/react";

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
// that cannot ride a flight carries the flight's clock itself.
//
// THIS USED TO BE A TABLE. One part per transition, each with that
// transition's length written into it as a literal delay — eight rows,
// hand-copied from six sources, and a case with no row got no part at all: the
// name resolved to nothing and the header simply appeared, which is the
// `chrome-tether` incident devWarn.ts was written for. A consumer's own
// transition was in exactly that position, always.
//
// `after: "flight"` is the length nobody has to know. The part waits for
// whichever transition is carrying it and then lowers the header, so this is
// one part for every case including the ones nobody has written yet.
//
// One case changed with the table: `none` has a zero flight, so the header is
// never covered and now fades in over IN rather than appearing at once. A
// third of a second of a header settling is not the flash this part exists to
// remove, and it is not worth a special case that only a table could hold.
const IN = 0.32;
const OUT = 0.16;
const EASE_IN: [number, number, number, number] = [0, 0, 0.2, 1];
const EASE_OUT: [number, number, number, number] = [0.4, 0, 1, 1];

// The entrance is a SLIDE, not just a fade: hidden a step above its resting
// line, it comes down into place as it clears — a header being lowered onto
// the page rather than a scrim materialising over it.
const SHOWN = { opacity: 1, y: 0 };
const HIDDEN = { opacity: 0, y: -24 };
const REST = { value: SHOWN, options: { duration: 0 } };

export const DETAIL_CHROME = "detail-chrome" as const;

const arrival = {
  value: SHOWN,
  options: { duration: IN, after: "flight" as const, ease: EASE_IN }
};

// The pop REVERSES the entrance: the header lifts back above its line in the
// flight's first beat, the same "leaves early" the card-body part keeps, so
// the page reads as disassembling before it goes rather than dragging its
// chrome down with it.
const detailChrome = createRawPartTransition({
  name: DETAIL_CHROME,
  initial: HIDDEN,
  idle: REST,
  pushOnEnter: arrival,
  pushOnExit: REST,
  replaceOnEnter: arrival,
  replaceOnExit: REST,
  popOnEnter: { value: HIDDEN, options: { duration: OUT, ease: EASE_OUT } },
  popOnExit: REST,
  completedOnEnter: REST,
  completedOnExit: REST
});

const detailChromes = [detailChrome];

export default detailChromes;
