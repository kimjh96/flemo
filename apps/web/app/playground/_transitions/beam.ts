"use client";

import { createDecorator, createTransition } from "@flemo/react";

// Transition + decorator combo built on rotation, not scale. As the new screen
// rises, a soft **beam** of light — a single cool wedge from a conic gradient —
// swings in an arc across the screen behind it, like a lighthouse or radar
// sweep. The decorator animates `rotate` (the whole conic layer turns), which
// is a different axis of motion from ember's bloom and pulse's expanding ring.
// A constant oversize (`scale: 1.6`) keeps the beam reaching the corners as it
// turns.
const BEAM =
  "conic-gradient(from 0deg at 50% 50%, rgba(140, 180, 255, 0) 0deg, rgba(140, 180, 255, 0.5) 28deg, rgba(140, 180, 255, 0) 72deg, rgba(140, 180, 255, 0) 360deg)";

const BEAM_BASE = { background: BEAM, scale: 1.6 } as const;

export const beam = createDecorator({
  name: "beam",
  initial: { ...BEAM_BASE, opacity: 0, rotate: -120 },
  idle: {
    value: { ...BEAM_BASE, opacity: 0, rotate: -120 },
    options: { duration: 0 }
  },
  enter: {
    value: { ...BEAM_BASE, opacity: 1, rotate: 110 },
    options: { duration: 0.6, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { ...BEAM_BASE, opacity: 0, rotate: -120 },
    options: { duration: 0.4 }
  }
});

const beamTransition = createTransition({
  name: "beam",
  initial: { y: "100%" },
  idle: {
    value: { y: 0 },
    options: { duration: 0 }
  },
  enter: {
    value: { y: 0 },
    options: { duration: 0.6, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { y: "100%" },
    options: { duration: 0.42, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: {},
    options: { duration: 0.6 }
  },
  exitBack: {
    value: {},
    options: { duration: 0.42 }
  },
  options: { decoratorName: "beam" }
});

export default beamTransition;
