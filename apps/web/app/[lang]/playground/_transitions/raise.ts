import { createRawTransition } from "@flemo/react";

import "./raise.types";

// The RAW factory, which is the one to reach for when a status needs its own
// answer rather than a mirrored one.
//
// `createTransition` collapses the ten variants into four, which is right when
// a pop is the push played backwards. This one is not: it rises from below on
// the way in and leaves DOWNWARD on the way out, which are two different
// motions on the same element, and it makes the push and the swipe-back read
// as the same gesture in two directions. A `replace` gets neither — it swaps in
// place, because there is no stack move to describe.
const IN = 0.42;
const OUT = 0.34;
const EASE_IN: [number, number, number, number] = [0.2, 0.9, 0.2, 1];
const EASE_OUT: [number, number, number, number] = [0.4, 0, 0.9, 0.35];
const REST = { y: 0, scale: 1, opacity: 1 };
const STILL = { value: REST, options: { duration: 0 } };

const raise = createRawTransition({
  name: "raise",
  initial: { y: "18%", scale: 0.98, opacity: 0 },
  idle: STILL,
  // Arriving on a push: up into place.
  pushOnEnter: { value: REST, options: { duration: IN, ease: EASE_IN } },
  // The screen underneath holds still. It is opaque and there is a whole stack
  // behind it — see the note in `fade`.
  pushOnExit: STILL,
  // A replace has no stack move to describe, so it just appears.
  replaceOnEnter: { value: REST, options: { duration: 0.2, ease: EASE_IN } },
  replaceOnExit: STILL,
  // Leaving on a pop: down and out, faster than it came in, which is what makes
  // a dismissal feel like a dismissal rather than a rewind.
  //
  // `popOnEnter` is the DISMISSING screen, and the name is a trap worth naming:
  // the active flag follows the STACK, not the direction of travel, so the
  // screen on top is still the "-true" side while it leaves. `popOnExit` is
  // the screen being returned to.
  popOnEnter: {
    value: { y: "22%", scale: 0.98, opacity: 0 },
    options: { duration: OUT, ease: EASE_OUT }
  },
  popOnExit: STILL,
  completedOnEnter: STILL,
  completedOnExit: STILL
});

export default raise;
