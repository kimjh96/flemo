"use client";

import { createDecorator, createTransition } from "@flemo/react";

// Diving forward through depth. The new screen rushes in from a tiny point
// (scale 0.2) while the old one scales up and out as a dark tunnel vignette
// closes around it, reading as rushing past into the distance.
const TUNNEL = "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 12%, rgba(0,0,0,0.78) 78%)";

export const tunnel = createDecorator({
  name: "tunnel",
  initial: { background: TUNNEL, opacity: 0, scale: 1 },
  idle: { value: { background: TUNNEL, opacity: 0, scale: 1 }, options: { duration: 0 } },
  enter: {
    value: { background: TUNNEL, opacity: 1, scale: 1.4 },
    options: { duration: 0.5, ease: [0.32, 0.72, 0, 1] }
  },
  exit: { value: { background: TUNNEL, opacity: 0, scale: 1 }, options: { duration: 0.4 } }
});

const dive = createTransition({
  name: "dive",
  initial: { scale: 0.2, opacity: 0 },
  idle: { value: { scale: 1, opacity: 1 }, options: { duration: 0 } },
  enter: { value: { scale: 1, opacity: 1 }, options: { duration: 0.5, ease: [0.32, 0.72, 0, 1] } },
  enterBack: {
    value: { scale: 0.2, opacity: 0 },
    options: { duration: 0.4, ease: [0.32, 0.72, 0, 1] }
  },
  exit: { value: { scale: 1.4, opacity: 0 }, options: { duration: 0.5, ease: [0.32, 0.72, 0, 1] } },
  exitBack: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.4, ease: [0.32, 0.72, 0, 1] }
  },
  options: { decoratorName: "tunnel" }
});

export default dive;
