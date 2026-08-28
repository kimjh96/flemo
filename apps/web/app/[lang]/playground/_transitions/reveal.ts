"use client";

import { createTransition } from "@flemo/react";

import "./reveal.types";

// A CONSUMER-AUTHORED transition, here so the bench is not four presets and
// nothing else: the point of the page is that a consumer's transition is not a
// second class of thing.
//
// It is modelled on the shape the library author uses for the site's own
// `shared-axis` transitions: a short offset plus a fade, one matched ease, and
// forward slightly longer than back so the pair reads as one motion played in
// reverse. Nothing here is clever; the last version of this page authored a
// clock table and generated part transitions from it, and the basics were wrong
// underneath all of that.
//
// What it does use that no preset does is `clip-path`, because the docs say the
// target is the whole CSS surface and endpoints need not share a template:
// `inset(0 0 0 100%)` against the `inset(0)` shorthand still tweens.
const EASE = [0.4, 0, 0.2, 1] as const;
const IN = 0.34;
const BACK = 0.28;

const reveal = createTransition({
  name: "reveal",
  initial: { clipPath: "inset(0 0 0 100%)" },
  idle: {
    value: { clipPath: "inset(0)", scale: 1, opacity: 1 },
    options: { duration: 0 }
  },
  // The arrival is uncovered left to right. It never changes its own opacity,
  // so there is no window in which the screen underneath reads through it.
  enter: {
    value: { clipPath: "inset(0)" },
    options: { duration: IN, ease: EASE }
  },
  enterBack: {
    value: { clipPath: "inset(0 0 0 100%)" },
    options: { duration: BACK, ease: EASE }
  },
  // The covered screen settles back a little rather than sliding: a lateral
  // move would be a second, competing direction next to the wipe.
  exit: {
    value: { scale: 0.97, opacity: 0.7 },
    options: { duration: IN, ease: EASE }
  },
  exitBack: {
    value: { scale: 1, opacity: 1 },
    options: { duration: BACK, ease: EASE }
  }
});

export default reveal;
