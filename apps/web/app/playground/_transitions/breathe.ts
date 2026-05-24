"use client";

import { createTransition } from "@flemo/react";

// Replica of the production "breathe" transition the shiflo app uses for
// bottom-nav tab navigation. Cross-fades + scales 0.99 ↔ 1 with a soft
// easing so the sibling-tab swap stays calm while the shared bottom bar
// holds still.
const breathe = createTransition({
  name: "breathe",
  initial: { scale: 0.99, opacity: 0 },
  idle: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }
  },
  enter: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }
  },
  enterBack: {
    value: { scale: 0.99, opacity: 0 },
    options: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }
  },
  exit: {
    value: { scale: 0.99, opacity: 0 },
    options: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }
  },
  exitBack: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }
  }
});

export default breathe;
