import { createRawPartTransition } from "@flemo/react";

import "./detailContent.types";

// The choreography for everything on the detail screen that is NOT the shared
// element: the back bar, and the body copy inside the card.
//
// A morph only moves what is paired. Anything else just appears the moment its
// screen does — which next to an element that is growing into place reads as
// two unrelated events. `<Part>` is what the library gives that content: a
// named transition on the screen's own clock, so the text arrives with the
// element instead of beside it.
//
// The RAW factory, not `createPartTransition`, for one reason: the collapsed
// idle/enter/exit model hands `POPPING-true` — the screen being dismissed — the
// same rest variant as the arrival, so the copy would sit there at full opacity
// for the arrival's whole duration while its screen waits to be cut. The engine
// spans a screen's choreography even when the screen transition itself has none
// (that is what makes a `<Part>` work under `none` at all), so a rest variant
// with a long clock on it is not free: under `none` it is the ENTIRE length of
// the navigation, spent on a screen that is doing nothing.
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];
const REST = { opacity: 1, y: 0 };
// A rest state is not a motion. Anything that is only holding still says so
// with a zero clock, so it costs the navigation nothing.
const HELD = { value: REST, options: { duration: 0 } };
const ARRIVE = { value: REST, options: { duration: 0.4, ease: EASE, delay: 0.08 } };
// Leaving is shorter than arriving — the eye is already following the element
// out — and it is a real motion, so the screen is never just standing there
// blank while the morph finishes.
const LEAVE = { value: { opacity: 0, y: 6 }, options: { duration: 0.22, ease: EASE } };

const detailContent = createRawPartTransition({
  name: "detail-content",
  initial: { opacity: 0, y: 10 },
  idle: HELD,
  pushOnEnter: ARRIVE,
  pushOnExit: HELD,
  replaceOnEnter: ARRIVE,
  replaceOnExit: HELD,
  // The dismissing screen's copy: it goes with the element, not after it.
  popOnEnter: LEAVE,
  popOnExit: HELD,
  completedOnEnter: HELD,
  completedOnExit: HELD
});

export default detailContent;
