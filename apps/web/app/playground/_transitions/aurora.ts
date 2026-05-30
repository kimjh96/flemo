"use client";

import { createDecorator, createTransition } from "@flemo/react";

// Transition + decorator combo. The new screen rises into place while a soft
// multi-color **aurora** — indigo → fuchsia → cyan — drifts across the screen
// behind it. Because the wash is colored (not white), it reads clearly on
// light surfaces, and animating `backgroundPosition` makes the colors slide,
// so the backdrop shimmers like northern lights rather than sitting still.
const AURORA_BASE = {
  background:
    "linear-gradient(120deg, rgba(99, 102, 241, 0.45) 0%, rgba(236, 72, 153, 0.4) 48%, rgba(34, 211, 238, 0.42) 100%)",
  backgroundSize: "220% 220%",
  backgroundRepeat: "no-repeat"
} as const;

export const aurora = createDecorator({
  name: "aurora",
  initial: { ...AURORA_BASE, opacity: 0, backgroundPosition: "0% 50%" },
  idle: {
    value: { ...AURORA_BASE, opacity: 0, backgroundPosition: "0% 50%" },
    options: { duration: 0 }
  },
  enter: {
    value: { ...AURORA_BASE, opacity: 1, backgroundPosition: "100% 50%" },
    options: { duration: 0.6, ease: [0.4, 0, 0.6, 1] }
  },
  exit: {
    value: { ...AURORA_BASE, opacity: 0, backgroundPosition: "100% 50%" },
    options: { duration: 0.4 }
  }
});

const auroraTransition = createTransition({
  name: "aurora",
  initial: { y: "100%" },
  idle: {
    value: { y: 0 },
    options: { duration: 0 }
  },
  enter: {
    value: { y: 0 },
    options: { duration: 0.55, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { y: "100%" },
    options: { duration: 0.4, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: {},
    options: { duration: 0.55 }
  },
  exitBack: {
    value: {},
    options: { duration: 0.4 }
  },
  options: { decoratorName: "aurora" }
});

export default auroraTransition;
