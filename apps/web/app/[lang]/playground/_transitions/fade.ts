import { createTransition } from "@flemo/react";

import { CLOCKS } from "./clocks";

import "./fade.types";

// A consumer-authored dissolve.
//
// Its timing is READ from the clock table rather than declared here, which is
// the whole discipline of this rebuild: the transition and the parts riding it
// are generated from one row, so they cannot be retimed apart. Changing
// `CLOCKS.fade` moves the screen, the bar's label and the body copy together.
//
// The rule it keeps: only ONE screen moves at a time. A push settles the
// arrival in over a screen that holds perfectly still; a pop takes the
// dismissal back out over one. Fading both at once is worse than it looks — two
// opaque screens at half opacity double-expose, and flemo keeps the screens
// below a push mounted, so a translucent covered screen is a window onto the
// whole stack rather than onto a background.
//
// Two corrections are recorded in it, because both are easy to walk back into:
//
// 1. A FRONT-LOADED curve. It was authored with one, on the reasoning that a
//    screen should get out of the way early and leave the rest of the flight to
//    whatever else is moving. There is nothing else moving here. Measured, the
//    opacity was 90% resolved at 30% of the clock, which reads as a light
//    switch rather than a dissolve. The curve is even.
//
// 2. OPACITY ALONE was not symmetric to the eye, however symmetric it is on
//    paper. On a push the arriving screen is opaque within a few frames and its
//    content is still settling, so there is something to watch; on a pop the
//    screen underneath is fully visible from the first frame and the only event
//    is a screen vanishing. Same numbers, half the transition. A little scale
//    gives the dismissal a motion of its own and the arrival the same one
//    reversed: 1.02 to 1 going in, back to 1.02 coming out. It never opens a
//    gap at the edges, because it only ever scales UP from rest.
const { duration, ease } = CLOCKS.fade!;
const REST = { opacity: 1, scale: 1 };
const STILL = { value: REST, options: { duration: 0 } };

const fade = createTransition({
  name: "fade",
  initial: { opacity: 0, scale: 1.02 },
  idle: STILL,
  enter: { value: REST, options: { duration, ease } },
  // Leaving: the way it came in, reversed.
  enterBack: { value: { opacity: 0, scale: 1.02 }, options: { duration, ease } },
  exit: STILL,
  exitBack: STILL
});

export default fade;
