"use client";

import { createDecorator, createTransition } from "@flemo/react";

// Transition + decorator combo with a *moving* decorator. As the new screen
// lifts in with a soft cross-fade, a diagonal **sheen** — a bright band — sweeps
// across the screen behind it, like light glancing off glass. The decorator
// animates `backgroundPosition` (not just opacity), so the highlight actually
// travels. The backdrop holds still so the sweep reads clearly.
const SHEEN_BASE = {
  background:
    "linear-gradient(115deg, transparent 42%, rgba(255, 255, 255, 0.55) 50%, transparent 58%)",
  backgroundSize: "250% 250%",
  backgroundRepeat: "no-repeat"
} as const;

export const sheen = createDecorator({
  name: "sheen",
  initial: { ...SHEEN_BASE, opacity: 0, backgroundPosition: "180% 0%" },
  idle: {
    value: { ...SHEEN_BASE, opacity: 0, backgroundPosition: "180% 0%" },
    options: { duration: 0 }
  },
  enter: {
    value: { ...SHEEN_BASE, opacity: 1, backgroundPosition: "-80% 0%" },
    options: { duration: 0.55, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { ...SHEEN_BASE, opacity: 0, backgroundPosition: "-80% 0%" },
    options: { duration: 0.4 }
  }
});

const shine = createTransition({
  name: "shine",
  initial: { y: 24, opacity: 0 },
  idle: {
    value: { y: 0, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { y: 0, opacity: 1 },
    options: { duration: 0.55, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { y: 24, opacity: 0 },
    options: { duration: 0.4, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: {},
    options: { duration: 0.55 }
  },
  exitBack: {
    value: {},
    options: { duration: 0.4 }
  },
  options: { decoratorName: "sheen" }
});

export default shine;
