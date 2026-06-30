"use client";

import { createTransition } from "@flemo/react";

// Blur + fade. The entering screen lifts out of focus and settles crisp; the
// leaving screen drifts back into focus and fades. `filter: blur()` interpolates
// natively, so this is a single compiled keyframe per variant, no JS in the loop.
const blur = createTransition({
  name: "blur",
  initial: { filter: "blur(12px)", opacity: 0 },
  idle: { value: { filter: "blur(0px)", opacity: 1 }, options: { duration: 0 } },
  enter: {
    value: { filter: "blur(0px)", opacity: 1 },
    options: { duration: 0.32, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { filter: "blur(12px)", opacity: 0 },
    options: { duration: 0.28, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { filter: "blur(12px)", opacity: 0 },
    options: { duration: 0.32, ease: [0.32, 0.72, 0, 1] }
  },
  exitBack: {
    value: { filter: "blur(0px)", opacity: 1 },
    options: { duration: 0.28, ease: [0.32, 0.72, 0, 1] }
  }
});

export default blur;
