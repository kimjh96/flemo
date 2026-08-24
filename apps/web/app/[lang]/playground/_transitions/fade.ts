import { createTransition } from "@flemo/react";

import "./fade.types";

// The simplest consumer-authored transition there is, and the one that shows
// the rule a cross-fade has to obey in a STACK.
//
// Only ONE screen moves at a time. A push fades the arrival in over a screen
// that holds perfectly still; a pop fades the dismissal out over one. The
// obvious alternative — fade one out while the other fades in — is worse than
// it looks: two opaque screens at half opacity double-expose, and flemo keeps
// the screens below a push mounted, so a translucent covered screen is a
// window onto the whole stack rather than onto a background.
//
// The curve is front-loaded for the same reason the `layout` preset's is: an
// opacity that finishes early leaves the rest of the flight for anything else
// on the screen — a shared element, a <Part> — to be the thing being watched.
const DURATION = 0.32;
const EASE: [number, number, number, number] = [0.2, 0.9, 0.2, 1];
const STILL = { value: { opacity: 1 }, options: { duration: 0 } };

const fade = createTransition({
  name: "fade",
  initial: { opacity: 0 },
  idle: STILL,
  enter: {
    value: { opacity: 1 },
    options: { duration: DURATION, ease: EASE }
  },
  // Leaving: the screen that was on top fades away, and what is underneath is
  // already in place rather than arriving.
  enterBack: {
    value: { opacity: 0 },
    options: { duration: DURATION, ease: EASE }
  },
  exit: STILL,
  exitBack: STILL
});

export default fade;
