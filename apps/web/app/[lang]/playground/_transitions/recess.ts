"use client";

import { createDecorator } from "@flemo/react";

import { DRIFT_BACK, DRIFT_IN } from "./drift.constants";

import "./recess.types";

// A CONSUMER-AUTHORED decorator, written because `layout` says in so many
// words that this is the consumer's job and names the trap:
//
//   layout.ts
//     "A decorator is compiled once per NAME, not once per transition that
//      names it: one set of keyframes, with the durations its author wrote.
//      `overlay`'s are 0.7s, sized for cupertino ... A consumer who wants one
//      authors it: `createDecorator` is public, and the timing to match is the
//      transition's own."
//
// So it does not reuse `overlay`, whose 0.7s would outlive `drift` by more than
// twice its flight and leave a wash lifting off a screen that stopped moving
// long ago. It imports `drift`'s own two durations rather than restating them,
// which is the only way the two stay matched when either is retuned.
//
// The dim is lighter than `overlay`'s. `drift` already pushes the covered
// screen back in scale, so the dim is a second cue for the same depth rather
// than the only one, and at 0.1 it read as a grey cast over a screen that was
// visibly receding anyway.
const DIM = "rgba(0, 0, 0, 0.06)";

const recess = createDecorator({
  name: "recess",
  initial: { opacity: 0, backgroundColor: DIM },
  idle: {
    value: { opacity: 0, backgroundColor: DIM },
    options: { duration: 0 }
  },
  // The screen going behind. Matches `drift.enter`, so the dim arrives with the
  // screen that is causing it.
  enter: {
    value: { opacity: 1, backgroundColor: DIM },
    options: { duration: DRIFT_IN }
  },
  // The screen coming back to the front. Matches `drift.enterBack`, the span of
  // the pop that uncovers it.
  exit: {
    value: { opacity: 0, backgroundColor: DIM },
    options: { duration: DRIFT_BACK }
  }
});

export default recess;
