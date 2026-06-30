"use client";

import { createTransition } from "@flemo/react";

import { SLIDE_DURATION, SLIDE_DURATION_BACK, SLIDE_EASE } from "./slide.constants";

// Full-page vertical shove (forward). The incoming page rises up from the bottom
// while the outgoing page is pushed up and out the top, both move together, so
// one page visibly shoves the other off-screen. Used when entering the
// Playground from a lower-index peer.
const pageShoveForward = createTransition({
  name: "page-shove-forward",
  initial: { y: "100%" },
  idle: { value: { y: 0 }, options: { duration: 0 } },
  enter: { value: { y: 0 }, options: { duration: SLIDE_DURATION, ease: SLIDE_EASE } },
  enterBack: { value: { y: "100%" }, options: { duration: SLIDE_DURATION_BACK, ease: SLIDE_EASE } },
  exit: { value: { y: "-100%" }, options: { duration: SLIDE_DURATION, ease: SLIDE_EASE } },
  exitBack: { value: { y: 0 }, options: { duration: SLIDE_DURATION_BACK, ease: SLIDE_EASE } }
});

export default pageShoveForward;
