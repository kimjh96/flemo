"use client";

import { createTransition } from "@flemo/react";

// iOS-style card present. The entering screen rises from the bottom while the
// one it covers scales back and dims, stacking behind like a sheet over a
// dimmed backdrop. On pop the card slides back down.
const cardStack = createTransition({
  name: "card-stack",
  initial: { y: "100%" },
  idle: { value: { y: 0, scale: 1, opacity: 1 }, options: { duration: 0 } },
  enter: { value: { y: 0 }, options: { duration: 0.4, ease: [0.32, 0.72, 0, 1] } },
  enterBack: { value: { y: "100%" }, options: { duration: 0.34, ease: [0.32, 0.72, 0, 1] } },
  exit: {
    value: { scale: 0.93, opacity: 0.55 },
    options: { duration: 0.4, ease: [0.32, 0.72, 0, 1] }
  },
  exitBack: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.34, ease: [0.32, 0.72, 0, 1] }
  }
});

export default cardStack;
