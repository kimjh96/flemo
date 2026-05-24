"use client";

import { createTransition } from "@flemo/react";

// Forward slide — the new content enters from the right while the outgoing
// content exits to the left. Used for segment tab moves in the forward
// direction (e.g. Albums → Songs).
const slideLeft = createTransition({
  name: "slide-left",
  initial: { x: "100%" },
  idle: {
    value: { x: 0 },
    options: { duration: 0 }
  },
  enter: {
    value: { x: 0 },
    options: { duration: 0.28, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { x: "100%" },
    options: { duration: 0.24, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { x: "-100%" },
    options: { duration: 0.28, ease: [0.32, 0.72, 0, 1] }
  },
  exitBack: {
    value: { x: 0 },
    options: { duration: 0.24, ease: [0.32, 0.72, 0, 1] }
  }
});

export default slideLeft;
