"use client";

import { createTransition } from "@flemo/react";

// Iris reveal. The entering screen opens through a circular `clip-path` growing
// from the center until it covers the viewport (75% reaches the far corner at
// any aspect ratio). The screen underneath recedes and dims.
const reveal = createTransition({
  name: "reveal",
  initial: { clipPath: "circle(0% at 50% 50%)" },
  idle: {
    value: { clipPath: "circle(75% at 50% 50%)", scale: 1, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { clipPath: "circle(75% at 50% 50%)" },
    options: { duration: 0.55, ease: [0.65, 0, 0.35, 1] }
  },
  enterBack: {
    value: { clipPath: "circle(0% at 50% 50%)" },
    options: { duration: 0.45, ease: [0.65, 0, 0.35, 1] }
  },
  exit: {
    value: { scale: 0.94, opacity: 0.7 },
    options: { duration: 0.55, ease: [0.65, 0, 0.35, 1] }
  },
  exitBack: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.45, ease: [0.65, 0, 0.35, 1] }
  }
});

export default reveal;
