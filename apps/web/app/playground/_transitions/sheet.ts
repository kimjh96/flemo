"use client";

import { createDecorator, createTransition } from "@flemo/react";

// Transition + decorator combo — an iOS-style modal present. The new screen
// rises from the bottom like a sheet, while a **dim** decorator darkens the
// screen behind it. The backdrop holds still (the transition's `exit` is a
// no-op) and the dark dim does the depth work, so the part of the backdrop
// still visible above the rising sheet reads as "pushed back behind a scrim".
const DIM = "rgba(0, 0, 0, 0.55)";

export const dim = createDecorator({
  name: "dim",
  initial: { opacity: 0, backgroundColor: DIM },
  idle: {
    value: { opacity: 0, backgroundColor: DIM },
    options: { duration: 0 }
  },
  enter: {
    value: { opacity: 1, backgroundColor: DIM },
    options: { duration: 0.42 }
  },
  exit: {
    value: { opacity: 0, backgroundColor: DIM },
    options: { duration: 0.34 }
  }
});

const sheet = createTransition({
  name: "sheet",
  initial: { y: "100%" },
  idle: {
    value: { y: 0 },
    options: { duration: 0 }
  },
  enter: {
    value: { y: 0 },
    options: { duration: 0.42, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { y: "100%" },
    options: { duration: 0.34, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: {},
    options: { duration: 0.42 }
  },
  exitBack: {
    value: {},
    options: { duration: 0.34 }
  },
  options: { decoratorName: "dim" }
});

export default sheet;
