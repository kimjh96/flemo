"use client";

import { createDecorator, createTransition } from "@flemo/react";

// Transition + decorator combo, the inverse of a bloom. The new screen settles
// in while a soft cool-toned glow behind it starts large and diffuse, then
// *converges* to a concentrated point of light at the center (the decorator
// animates `scale` 1.7 → 0.55, intensifying as it shrinks) — light pulling into
// focus. Distinct from ember (glow blooms outward) and pulse (a ring expands
// out); this one collapses inward. The cool tint keeps it visible on light
// surfaces.
const FOCUS_GLOW =
  "radial-gradient(circle at 50% 50%, rgba(130, 160, 255, 0.55) 0%, rgba(130, 160, 255, 0.2) 35%, rgba(130, 160, 255, 0) 65%)";

export const focus = createDecorator({
  name: "focus",
  initial: { background: FOCUS_GLOW, opacity: 0, scale: 1.7 },
  idle: {
    value: { background: FOCUS_GLOW, opacity: 0, scale: 1.7 },
    options: { duration: 0 }
  },
  enter: {
    value: { background: FOCUS_GLOW, opacity: 1, scale: 0.55 },
    options: { duration: 0.55, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { background: FOCUS_GLOW, opacity: 0, scale: 1.7 },
    options: { duration: 0.4 }
  }
});

const focusTransition = createTransition({
  name: "focus",
  initial: { scale: 1.06, opacity: 0 },
  idle: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.5, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { scale: 1.06, opacity: 0 },
    options: { duration: 0.4, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: {},
    options: { duration: 0.5 }
  },
  exitBack: {
    value: {},
    options: { duration: 0.4 }
  },
  options: { decoratorName: "focus" }
});

export default focusTransition;
