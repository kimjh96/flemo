import { createTransition } from "@flemo/react";

import "./drift.types";

// A second CONSUMER-authored transition, here for one reason: the chain
// fixture needs a step that flemo does not ship, so "does a stack of mixed
// transitions still unwind correctly" is not answered only by the built-ins.
//
// It is REVEAL-shaped: everything visible happens on the arriving screen, and
// the screen being covered does not move at all.
//
// That is a correction, and worth writing down because the mistake is an easy
// one to make. This transition first said `exit: { scale: 0.94, opacity: 0.5 }`
// — recede and dim, which reads fine in isolation. It is not fine in a STACK.
// A covered screen at half opacity is a window onto every screen below it, and
// flemo keeps those mounted (that is what makes a pop instant); the deeper ones
// are hidden, but not in the same frame as the tap. So for the first frames of
// the push you were looking through four screens at once, and the one two down
// faded up through the one above it.
//
// The lesson generalises: a transition that makes the covered screen
// TRANSLUCENT is claiming there is nothing behind it, and in a stack there
// always is. Recede a screen with a decorator (an opaque dim layer between the
// two) rather than with its own opacity.
const DURATION = 0.42;
const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
const STILL = { value: { x: 0, scale: 1, opacity: 1 }, options: { duration: 0 } };

const drift = createTransition({
  name: "drift",
  initial: { x: 56, scale: 0.96, opacity: 0 },
  idle: {
    value: { x: 0, scale: 1, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { x: 0, scale: 1, opacity: 1 },
    options: { duration: DURATION, ease: EASE }
  },
  enterBack: {
    value: { x: 56, scale: 0.96, opacity: 0 },
    options: { duration: DURATION, ease: EASE }
  },
  // The covered screen holds still and stays opaque — see above.
  exit: STILL,
  exitBack: STILL
});

export default drift;
