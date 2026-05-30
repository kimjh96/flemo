"use client";

import { createTransition } from "@flemo/react";

// Iris reveal. The entering screen opens through a circular `clip-path` that
// grows from a point at the center until it just covers the viewport. A
// `circle()` whose radius reaches the farthest corner is 70.7% of the
// reference length regardless of aspect ratio, so we end at `75%` (a hair past
// full coverage) — that way the whole duration is spent on *visible* growth
// instead of expanding invisibly past the edges. An ease-in-out curve over a
// relaxed duration keeps the iris readable the whole way. The screen
// underneath recedes and dims. `clip-path` interpolates between same-shape
// `circle()`s, so this stays a single compiled keyframe per variant.
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
