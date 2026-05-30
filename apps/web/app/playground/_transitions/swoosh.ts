"use client";

import { createDecorator, createTransition } from "@flemo/react";

// A transition + decorator combo. The entering screen swooshes in diagonally
// from the bottom-right corner while fading up, and a **scrim** decorator
// lays a cinematic dark gradient (heavier at the bottom) over the screen
// behind it. The diagonal entry plus the directional scrim give it a
// dynamic, filmic feel.
const SCRIM = "linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0) 45%)";

export const scrim = createDecorator({
  name: "scrim",
  initial: { opacity: 0, background: SCRIM },
  idle: {
    value: { opacity: 0, background: SCRIM },
    options: { duration: 0 }
  },
  enter: {
    value: { opacity: 1, background: SCRIM },
    options: { duration: 0.4 }
  },
  exit: {
    value: { opacity: 0, background: SCRIM },
    options: { duration: 0.32 }
  }
});

const swoosh = createTransition({
  name: "swoosh",
  initial: { x: "40%", y: "40%", opacity: 0.3 },
  idle: {
    value: { x: 0, y: 0, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { x: 0, y: 0, opacity: 1 },
    options: { duration: 0.4, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { x: "40%", y: "40%", opacity: 0.3 },
    options: { duration: 0.32, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: {},
    options: { duration: 0.4 }
  },
  exitBack: {
    value: {},
    options: { duration: 0.32 }
  },
  options: { decoratorName: "scrim" }
});

export default swoosh;
