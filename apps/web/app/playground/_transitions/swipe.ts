"use client";

import { createDecorator, createTransition } from "@flemo/react";

// Co-designed concept: a horizontal flick. The new screen snaps in from the
// right with a slight overshoot; the screen behind it slides left AND a soft
// streak of light sweeps left across it in the SAME direction — a motion trail
// that reinforces the swipe's axis and speed. Transition and decorator share
// one direction, so they read as a single gesture.
const TRAIL =
  "linear-gradient(90deg, rgba(130,170,255,0) 0%, rgba(130,170,255,0.4) 50%, rgba(130,170,255,0) 100%)";
const TRAIL_BASE = {
  background: TRAIL,
  backgroundSize: "55% 100%",
  backgroundRepeat: "no-repeat"
} as const;

export const trail = createDecorator({
  name: "trail",
  initial: { ...TRAIL_BASE, opacity: 0, backgroundPosition: "150% 0%" },
  idle: {
    value: { ...TRAIL_BASE, opacity: 0, backgroundPosition: "150% 0%" },
    options: { duration: 0 }
  },
  enter: {
    value: { ...TRAIL_BASE, opacity: 1, backgroundPosition: "-60% 0%" },
    options: { duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }
  },
  exit: {
    value: { ...TRAIL_BASE, opacity: 0, backgroundPosition: "-60% 0%" },
    options: { duration: 0.34 }
  }
});

const swipe = createTransition({
  name: "swipe",
  initial: { x: "100%" },
  idle: {
    value: { x: 0 },
    options: { duration: 0 }
  },
  enter: {
    value: { x: 0 },
    options: { duration: 0.44, ease: [0.3, 1.25, 0.5, 1] }
  },
  enterBack: {
    value: { x: "100%" },
    options: { duration: 0.34, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { x: "-22%" },
    options: { duration: 0.44, ease: [0.3, 1.25, 0.5, 1] }
  },
  exitBack: {
    value: { x: 0 },
    options: { duration: 0.34, ease: [0.32, 0.72, 0, 1] }
  },
  options: { decoratorName: "trail" }
});

export default swipe;
