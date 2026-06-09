"use client";

import { createTransition } from "@flemo/react";

// Reverse slide. The new content enters from the left while the outgoing
// content exits to the right. Used for segment tab moves backward (e.g.
// Songs → Albums).
const slideRight = createTransition({
  name: "slide-right",
  initial: { x: "-100%" },
  idle: {
    value: { x: 0 },
    options: { duration: 0 }
  },
  enter: {
    value: { x: 0 },
    options: { duration: 0.28, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { x: "-100%" },
    options: { duration: 0.24, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { x: "100%" },
    options: { duration: 0.28, ease: [0.32, 0.72, 0, 1] }
  },
  exitBack: {
    value: { x: 0 },
    options: { duration: 0.24, ease: [0.32, 0.72, 0, 1] }
  }
});

export default slideRight;
