"use client";

import { createDecorator, createTransition } from "@flemo/react";

// Co-designed concept: a drop in water. The new screen is revealed through a
// circle that expands from the center (clip-path), and the screen behind it
// carries concentric rings radiating from that SAME center point: the
// ripples a droplet would send out. The reveal circle and the rings share one
// origin, so they read as a single splash.
const RIPPLES =
  "repeating-radial-gradient(circle at 50% 50%, rgba(130,170,255,0) 0%, rgba(130,170,255,0) 6%, rgba(130,170,255,0.32) 7%, rgba(130,170,255,0) 8.5%)";

export const ripples = createDecorator({
  name: "ripples",
  initial: { background: RIPPLES, opacity: 0, scale: 0.3 },
  idle: {
    value: { background: RIPPLES, opacity: 0, scale: 0.3 },
    options: { duration: 0 }
  },
  enter: {
    value: { background: RIPPLES, opacity: 1, scale: 2.2 },
    options: { duration: 0.55, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { background: RIPPLES, opacity: 0, scale: 0.3 },
    options: { duration: 0.4 }
  }
});

const ripple = createTransition({
  name: "ripple",
  initial: { clipPath: "circle(0% at 50% 50%)" },
  idle: {
    value: { clipPath: "circle(75% at 50% 50%)", scale: 1, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { clipPath: "circle(75% at 50% 50%)" },
    options: { duration: 0.55, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { clipPath: "circle(0% at 50% 50%)" },
    options: { duration: 0.42, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { scale: 0.96 },
    options: { duration: 0.55, ease: [0.32, 0.72, 0, 1] }
  },
  exitBack: {
    value: { scale: 1 },
    options: { duration: 0.42, ease: [0.32, 0.72, 0, 1] }
  },
  options: { decoratorName: "ripples" }
});

export default ripple;
