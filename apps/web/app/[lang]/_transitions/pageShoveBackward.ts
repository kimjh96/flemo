"use client";

import { createTransition } from "@flemo/react";

import { SLIDE_DURATION, SLIDE_DURATION_BACK, SLIDE_EASE } from "./slide.constants";

// Full-page vertical shove (backward), the mirror of pageShoveForward. The
// incoming page drops down from the top while the outgoing page is pushed down
// and out the bottom. Used when leaving the Playground back to a lower-index
// peer.
const pageShoveBackward = createTransition({
  name: "page-shove-backward",
  initial: { y: "-100%" },
  idle: { value: { y: 0 }, options: { duration: 0 } },
  enter: { value: { y: 0 }, options: { duration: SLIDE_DURATION, ease: SLIDE_EASE } },
  enterBack: {
    value: { y: "-100%" },
    options: { duration: SLIDE_DURATION_BACK, ease: SLIDE_EASE }
  },
  exit: { value: { y: "100%" }, options: { duration: SLIDE_DURATION, ease: SLIDE_EASE } },
  exitBack: { value: { y: 0 }, options: { duration: SLIDE_DURATION_BACK, ease: SLIDE_EASE } }
});

export default pageShoveBackward;
