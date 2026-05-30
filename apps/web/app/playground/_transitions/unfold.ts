"use client";

import { createDecorator, createTransition } from "@flemo/react";

// Co-designed concept: an unrolling banner. The new screen unfolds downward
// from its top edge (scaleY from the top), and the screen behind it gains a
// crease-shadow that grows down from the top in lockstep — the shadow the
// descending banner would cast. Both scale from the same top origin, so the
// shadow tracks the unrolling edge.
const CREASE = "linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0) 55%)";
const CREASE_BASE = { background: CREASE, transformOrigin: "50% 0%" } as const;

export const crease = createDecorator({
  name: "crease",
  initial: { ...CREASE_BASE, opacity: 0, scaleY: 0 },
  idle: {
    value: { ...CREASE_BASE, opacity: 0, scaleY: 0 },
    options: { duration: 0 }
  },
  enter: {
    value: { ...CREASE_BASE, opacity: 1, scaleY: 1 },
    options: { duration: 0.5, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { ...CREASE_BASE, opacity: 0, scaleY: 0 },
    options: { duration: 0.4 }
  }
});

const unfold = createTransition({
  name: "unfold",
  initial: { scaleY: 0, transformOrigin: "50% 0%" },
  idle: {
    value: { scaleY: 1, transformOrigin: "50% 0%" },
    options: { duration: 0 }
  },
  enter: {
    value: { scaleY: 1, transformOrigin: "50% 0%" },
    options: { duration: 0.5, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { scaleY: 0, transformOrigin: "50% 0%" },
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
  options: { decoratorName: "crease" }
});

export default unfold;
