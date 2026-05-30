"use client";

import { createDecorator, createTransition } from "@flemo/react";

// Transition + decorator combo with a *blooming* decorator. The new screen
// scales up into place while a warm **glow** behind it blooms outward — a
// radial gradient that both fades in and scales up, so warm light swells from
// the lower center as the screen materializes. The decorator animates `scale`
// (not just opacity), which is what gives the bloom.
const GLOW =
  "radial-gradient(circle at 50% 65%, rgba(255, 138, 76, 0.55) 0%, rgba(255, 80, 120, 0.25) 40%, rgba(255, 80, 120, 0) 70%)";

export const glow = createDecorator({
  name: "glow",
  initial: { opacity: 0, scale: 0.85, background: GLOW },
  idle: {
    value: { opacity: 0, scale: 0.85, background: GLOW },
    options: { duration: 0 }
  },
  enter: {
    value: { opacity: 1, scale: 1.15, background: GLOW },
    options: { duration: 0.5, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { opacity: 0, scale: 0.85, background: GLOW },
    options: { duration: 0.4 }
  }
});

const ember = createTransition({
  name: "ember",
  initial: { scale: 0.88, opacity: 0 },
  idle: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.5, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { scale: 0.88, opacity: 0 },
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
  options: { decoratorName: "glow" }
});

export default ember;
