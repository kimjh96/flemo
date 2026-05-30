"use client";

import { createTransition } from "@flemo/react";

// Cross-zoom "dive". The entering screen scales up out of a small, soft state
// into focus; the leaving screen pushes forward (past 1) and fades, so you
// feel like you dove straight through it into the new one. `scale` + `opacity`
// only, so it compiles to a single compositor keyframe per variant — no JS.
const zoom = createTransition({
  name: "zoom",
  initial: { scale: 0.8, opacity: 0 },
  idle: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.34, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { scale: 0.8, opacity: 0 },
    options: { duration: 0.3, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { scale: 1.12, opacity: 0 },
    options: { duration: 0.34, ease: [0.32, 0.72, 0, 1] }
  },
  exitBack: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.3, ease: [0.32, 0.72, 0, 1] }
  }
});

export default zoom;
