"use client";

import { createDecorator, createTransition } from "@flemo/react";

// Transition + decorator combo. The new screen slides in from the right while
// the screen behind it slides partway out to the left (cupertino-style depth)
// and washes with a brand-blue **tint** decorator — so the outgoing screen
// reads as receding under a colored glass instead of a neutral dim. Same
// horizontal motion as cupertino, but the colored decorator gives it a
// branded, distinct feel.
const TINT = "rgba(49, 130, 246, 0.42)";

export const tint = createDecorator({
  name: "tint",
  initial: { opacity: 0, backgroundColor: TINT },
  idle: {
    value: { opacity: 0, backgroundColor: TINT },
    options: { duration: 0 }
  },
  enter: {
    value: { opacity: 1, backgroundColor: TINT },
    options: { duration: 0.45 }
  },
  exit: {
    value: { opacity: 0, backgroundColor: TINT },
    options: { duration: 0.38 }
  }
});

const drawer = createTransition({
  name: "drawer",
  initial: { x: "100%" },
  idle: {
    value: { x: 0 },
    options: { duration: 0 }
  },
  enter: {
    value: { x: 0 },
    options: { duration: 0.45, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { x: "100%" },
    options: { duration: 0.38, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { x: "-30%" },
    options: { duration: 0.45, ease: [0.32, 0.72, 0, 1] }
  },
  exitBack: {
    value: { x: 0 },
    options: { duration: 0.38, ease: [0.32, 0.72, 0, 1] }
  },
  options: { decoratorName: "tint" }
});

export default drawer;
