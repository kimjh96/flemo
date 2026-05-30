"use client";

import { createTransition } from "@flemo/react";

// Iris reveal. The entering screen opens through a circular `clip-path` that
// grows from a point at the center to cover the viewport, while the screen
// underneath recedes and dims — so the new screen irises open over a fading
// backdrop. `clip-path` interpolates between same-shape `circle()`s, so this
// stays a single compiled keyframe per variant.
const reveal = createTransition({
  name: "reveal",
  initial: { clipPath: "circle(0% at 50% 50%)" },
  idle: {
    value: { clipPath: "circle(150% at 50% 50%)", scale: 1, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { clipPath: "circle(150% at 50% 50%)" },
    options: { duration: 0.45, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { clipPath: "circle(0% at 50% 50%)" },
    options: { duration: 0.35, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { scale: 0.92, opacity: 0.6 },
    options: { duration: 0.45, ease: [0.32, 0.72, 0, 1] }
  },
  exitBack: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.35, ease: [0.32, 0.72, 0, 1] }
  }
});

export default reveal;
