"use client";

import { createTransition } from "@flemo/react";

// Iris reveal. The entering screen opens through a circular `clip-path` that
// grows from a point at the center to cover the viewport, and settles from a
// slight zoom (`scale` 1.12 → 1) so the forward reveal reads as a clear pop,
// not just an expanding hole. The screen underneath recedes and dims. The
// `clip-path` interpolates between same-shape `circle()`s, so this stays a
// single compiled keyframe per variant.
const reveal = createTransition({
  name: "reveal",
  initial: { clipPath: "circle(0% at 50% 50%)", scale: 1.12 },
  idle: {
    value: { clipPath: "circle(150% at 50% 50%)", scale: 1, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { clipPath: "circle(150% at 50% 50%)", scale: 1 },
    options: { duration: 0.45, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { clipPath: "circle(0% at 50% 50%)", scale: 1.12 },
    options: { duration: 0.35, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { scale: 0.9, opacity: 0.5 },
    options: { duration: 0.45, ease: [0.32, 0.72, 0, 1] }
  },
  exitBack: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.35, ease: [0.32, 0.72, 0, 1] }
  }
});

export default reveal;
