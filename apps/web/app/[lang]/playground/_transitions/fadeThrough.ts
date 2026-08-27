"use client";

import { createTransition } from "@flemo/react";

import "./fadeThrough.types";

// Material's fade-through, authored with `delay` so the two opacity ramps meet
// rather than overlap: the leaving screen reaches zero exactly as the arriving
// one starts from zero. That sequencing is the whole pattern, and it is the
// same conclusion `layout` reached from the other side:
//
//   layout.ts
//     "two opaque screens at half opacity double-expose, and the muddle reads
//      as flicker exactly where a shared element is meant to be carrying the
//      eye."
//
// `layout` avoids the overlap by moving one side only. This avoids it by
// moving both sides in sequence, and pays for it with an instant where neither
// screen is drawn. On this bench that instant is worth looking at: the shared
// element is above both screens and never leaves, so it carries the eye across
// the gap that the screens themselves cannot cover.
//
// The arriving screen grows from 92%, the canonical figure, rather than
// shrinking toward the viewer. Combined with the sequencing it reads as one
// surface being replaced rather than one sliding over another, which is what
// separates peers from a drill-down.
const OUT = 0.13;
const IN = 0.32;
const EASE_OUT: [number, number, number, number] = [0.4, 0, 1, 1];
const EASE_IN: [number, number, number, number] = [0, 0, 0.2, 1];

const fadeThrough = createTransition({
  name: "fade-through",
  initial: { opacity: 0, scale: 0.92 },
  idle: {
    value: { opacity: 1, scale: 1 },
    options: { duration: 0 }
  },
  // Held back by exactly the span the leaving screen needs, so the two never
  // paint at once.
  enter: {
    value: { opacity: 1, scale: 1 },
    options: { duration: IN, delay: OUT, ease: EASE_IN }
  },
  enterBack: {
    value: { opacity: 0, scale: 0.92 },
    options: { duration: OUT, ease: EASE_OUT }
  },
  // The leaving screen only fades. Scaling it as well would put two different
  // sizes on screen in the same instant the pattern exists to avoid.
  exit: {
    value: { opacity: 0 },
    options: { duration: OUT, ease: EASE_OUT }
  },
  exitBack: {
    value: { opacity: 1, scale: 1 },
    options: { duration: IN, delay: OUT, ease: EASE_IN }
  }
});

export default fadeThrough;
