"use client";

import { createDecorator, createTransition } from "@flemo/react";

// Transition + decorator combo. As the new screen lands, a bright **ring**
// radiates out from the center across the screen behind it — a sonar-style
// pulse. The decorator is a radial ring gradient that animates `scale` from a
// point out past the edges, so the ring expands and leaves the frame. The
// colored inner edge keeps it visible on any surface.
const RING =
  "radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0) 30%, rgba(255, 255, 255, 0.55) 42%, rgba(99, 102, 241, 0.45) 47%, rgba(255, 255, 255, 0) 56%)";

export const ring = createDecorator({
  name: "ring",
  initial: { background: RING, opacity: 0, scale: 0.2 },
  idle: {
    value: { background: RING, opacity: 0, scale: 0.2 },
    options: { duration: 0 }
  },
  enter: {
    value: { background: RING, opacity: 1, scale: 2.6 },
    options: { duration: 0.6, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { background: RING, opacity: 0, scale: 0.2 },
    options: { duration: 0.4 }
  }
});

const pulse = createTransition({
  name: "pulse",
  initial: { scale: 0.85, opacity: 0 },
  idle: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.5, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { scale: 0.85, opacity: 0 },
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
  options: { decoratorName: "ring" }
});

export default pulse;
